// Extend the existing safe Phase B runner; use the same disposable DB/restore
// safeguards and run both suites sequentially. Never reads the application .env.
process.env.CHATTO_PHASE_CD_TESTS = '1';
require('./test-phase-b-db.cjs');
