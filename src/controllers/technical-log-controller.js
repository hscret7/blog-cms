const defaultService = require('../services/technical-log-service').createTechnicalLogService();

function createTechnicalLogController(service = defaultService) {
  return {
    async showLogs(req, res) {
      res.set('Cache-Control', 'no-store');
      const result = await service.fetchLogs(req.query);

      return res.render('admin/system-logs', {
        user: req.user,
        logs: result.entries,
        total: result.entries.length,
        params: result.params,
        error: result.success ? null : result.message,
        allowedServices: service.ALLOWED_SERVICES,
        allowedIntervals: service.ALLOWED_INTERVALS,
        allowedErrorGroups: service.ALLOWED_ERROR_GROUPS
      });
    }
  };
}

module.exports = {
  createTechnicalLogController,
  showLogs: createTechnicalLogController().showLogs
};
