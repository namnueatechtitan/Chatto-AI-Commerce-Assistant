process.env.CHATTO_DASHBOARD_UI='1';
delete process.env.CHATTO_CONTEXT_UI;
process.env.CHATTO_RESPONSIVE_BUILD_DIR ||= '.next-dashboard-tests';
require('./responsive-ui.cjs');
