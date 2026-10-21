const ALLOWED_SERVICES = ['app', 'nginx', 'mysql', 'phpmyadmin'];
const ALLOWED_INTERVALS = ['15m', '1h', '6h', '24h', '7d'];
const ALLOWED_ERROR_GROUPS = ['', 'all', '5xx', '4xx', 'db_error', 'connection'];

const INTERVAL_SECONDS = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60
};

function sanitizeParams(raw = {}) {
  const service = typeof raw.service === 'string' && ALLOWED_SERVICES.includes(raw.service) ? raw.service : '';
  const interval = typeof raw.interval === 'string' && ALLOWED_INTERVALS.includes(raw.interval) ? raw.interval : '1h';
  const errorGroup = typeof raw.errorGroup === 'string' && ALLOWED_ERROR_GROUPS.includes(raw.errorGroup) ? raw.errorGroup : '';

  let keyword = '';
  if (typeof raw.q === 'string') {
    keyword = raw.q.trim().slice(0, 100);
    keyword = keyword.replace(/[\r\n\0]/g, '');
  }

  let limit = 100;
  if (raw.limit !== undefined && raw.limit !== null && raw.limit !== '') {
    const parsedLimit = Number(raw.limit);
    if (Number.isInteger(parsedLimit) && parsedLimit >= 10 && parsedLimit <= 500) {
      limit = parsedLimit;
    }
  }

  return { service, interval, errorGroup, keyword, limit };
}

function buildLogQL({ service, errorGroup, keyword }) {
  let streamSelector;
  if (ALLOWED_SERVICES.includes(service)) {
    streamSelector = `{project="blog-cms",service="${service}"}`;
  } else {
    streamSelector = '{project="blog-cms",service=~"app|nginx|mysql|phpmyadmin"}';
  }

  const pipeline = [];

  if (errorGroup === '5xx') {
    pipeline.push('| json | __error__="" | status >= 500 and status < 600');
  } else if (errorGroup === '4xx') {
    pipeline.push('| json | __error__="" | status >= 400 and status < 500');
  } else if (errorGroup === 'all') {
    pipeline.push('| json | __error__="" | status >= 400 and status < 600');
  } else if (errorGroup === 'db_error') {
    pipeline.push('|= "ERROR"');
  } else if (errorGroup === 'connection') {
    pipeline.push('|= "ECONNREFUSED"');
  }

  if (keyword) {
    const escaped = JSON.stringify(keyword);
    pipeline.push(`|= ${escaped}`);
  }

  return streamSelector + (pipeline.length ? ' ' + pipeline.join(' ') : '');
}

function parseLokiStreams(streams = []) {
  const entries = [];
  for (const item of streams) {
    const streamLabels = item.stream || {};
    const serviceName = streamLabels.service || streamLabels.job || 'unknown';
    const streamType = streamLabels.stream || '';
    const values = item.values || [];

    for (const [nanoTs, rawLine] of values) {
      const ms = Math.floor(Number(nanoTs.slice(0, 13)));
      const date = new Date(Number.isFinite(ms) ? ms : Date.now());
      const cleanLine = (rawLine || '').replace(/\r?\n$/, '');

      let parsedJson = null;
      if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
        try {
          parsedJson = JSON.parse(cleanLine);
        } catch {
          parsedJson = null;
        }
      }

      entries.push({
        timestamp: nanoTs,
        timeFormatted: new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(date),
        service: serviceName,
        streamType,
        rawLine: cleanLine,
        parsedJson
      });
    }
  }

  entries.sort((a, b) => {
    if (a.timestamp.length !== b.timestamp.length) {
      return b.timestamp.length - a.timestamp.length;
    }
    return b.timestamp.localeCompare(a.timestamp);
  });

  return entries;
}

function createTechnicalLogService({ lokiUrl = process.env.LOKI_URL || 'http://loki:3100', timeoutMs = 8000 } = {}) {
  return {
    sanitizeParams,
    buildLogQL,
    parseLokiStreams,
    ALLOWED_SERVICES,
    ALLOWED_INTERVALS,
    ALLOWED_ERROR_GROUPS,

    async fetchLogs(rawParams = {}) {
      const sanitized = sanitizeParams(rawParams);
      const logql = buildLogQL(sanitized);

      const seconds = INTERVAL_SECONDS[sanitized.interval] || 3600;
      const endNs = BigInt(Date.now()) * 1000000n;
      const startNs = endNs - BigInt(seconds) * 1000000000n;

      const urlObj = new URL('/loki/api/v1/query_range', lokiUrl);
      urlObj.searchParams.set('query', logql);
      urlObj.searchParams.set('start', startNs.toString());
      urlObj.searchParams.set('end', endNs.toString());
      urlObj.searchParams.set('limit', sanitized.limit.toString());
      urlObj.searchParams.set('direction', 'backward');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(urlObj.toString(), {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          await response.body?.cancel();
          return {
            success: false,
            status: 502,
            message: 'Hệ thống nhật ký từ chối truy vấn. Vui lòng thử lại hoặc kiểm tra Loki.',
            entries: [],
            params: sanitized,
            query: logql
          };
        }

        // Keep the deadline active until the entire bounded response is read.
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('INVALID_LOKI_RESPONSE');
          }
          chunks.push(Buffer.from(value));
        }
        const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (json.status !== 'success' || json.data?.resultType !== 'streams' ||
            !Array.isArray(json.data.result)) {
          throw new Error('INVALID_LOKI_RESPONSE');
        }
        const resultStreams = json.data.result;
        if (resultStreams.some(item => !item || !Array.isArray(item.values) ||
            item.values.some(value => !Array.isArray(value) || value.length !== 2 ||
              typeof value[0] !== 'string' || !/^\d{1,19}$/.test(value[0]) ||
              typeof value[1] !== 'string'))) {
          throw new Error('INVALID_LOKI_RESPONSE');
        }
        const entries = parseLokiStreams(resultStreams);

        return {
          success: true,
          status: 200,
          entries,
          total: entries.length,
          params: sanitized,
          query: logql
        };
      } catch (err) {
        clearTimeout(timer);
        const isTimeout = controller.signal.aborted;
        return {
          success: false,
          status: isTimeout ? 504 : 502,
          message: isTimeout
            ? 'Hết thời gian chờ kết nối Loki. Vui lòng thử lại với khoảng thời gian hoặc số dòng nhỏ hơn.'
            : 'Không thể đọc dữ liệu hợp lệ từ hệ thống nhật ký Loki. Vui lòng kiểm tra dịch vụ và thử lại.',
          entries: [],
          params: sanitized,
          query: logql
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

module.exports = {
  createTechnicalLogService,
  sanitizeParams,
  buildLogQL,
  parseLokiStreams,
  ALLOWED_SERVICES,
  ALLOWED_INTERVALS,
  ALLOWED_ERROR_GROUPS
};
