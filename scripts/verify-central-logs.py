#!/usr/bin/env python3
"""Generate harmless HTTP traffic and verify three real Loki queries."""
import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


QUERIES = [
    ('Log ứng dụng', 'range', '{project="blog-cms",service=~"app|nginx|mysql|phpmyadmin"}'),
    ('HTTP lỗi Nginx', 'range', '{project="blog-cms",service="nginx"} | json | __error__="" | status >= 400'),
    ('Đếm log theo dịch vụ', 'instant', 'sum by (service) (count_over_time({project="blog-cms",service=~"app|nginx|mysql|phpmyadmin"}[10m]))'),
]


def origin(value):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1') or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError('Chỉ dùng origin HTTP localhost hoặc 127.0.0.1.')
    return value.rstrip('/')


def get(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return response.read()


def query(base, expression, mode):
    end = time.time_ns()
    params = {'query': expression}
    endpoint = 'query'
    if mode == 'range':
        endpoint = 'query_range'
        params.update(start=str(end - 600 * 10**9), end=str(end), limit='100')
    else:
        params['time'] = str(end)
    data = json.loads(get(base + '/loki/api/v1/' + endpoint + '?' + urllib.parse.urlencode(params)))
    if data.get('status') != 'success':
        raise RuntimeError('Loki không trả status success.')
    return data['data']['result']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--website', type=origin, default='http://127.0.0.1:18090')
    parser.add_argument('--loki', type=origin, default='http://127.0.0.1:13100')
    args = parser.parse_args()
    get(args.loki + '/ready')
    get(args.website + '/')
    probe = '/loki-demo-' + uuid.uuid4().hex
    try:
        get(args.website + probe)
        raise RuntimeError('Đường dẫn thử phải trả 404.')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
    expression = '{project="blog-cms",service="nginx"} | json | __error__="" | path="' + probe + '" | status=404'
    for attempt in range(15):
        results = query(args.loki, expression, 'range')
        if any(item.get('values') for item in results):
            break
        time.sleep(2)
    else:
        raise RuntimeError('Chưa thấy request 404 vừa tạo sau 30 giây. Kiểm tra Promtail/targets, không báo PASS.')
    print('PASS: Request 404 vừa tạo đã đi qua Nginx → Promtail → Loki.')
    for title, mode, expression in QUERIES:
        results = query(args.loki, expression, mode)
        count = sum(len(row.get('values', [])) for row in results) if mode == 'range' else sum(float(row['value'][1]) for row in results)
        if count <= 0:
            raise RuntimeError(title + ': query chưa có dữ liệu.')
        print(f'PASS: {title}: {count:g} kết quả. LogQL: {expression}')
    print('Tiếp theo mở Grafana Explore và chạy ba query để chụp minh chứng.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print('FAIL: ' + str(error))
        raise SystemExit(1)
