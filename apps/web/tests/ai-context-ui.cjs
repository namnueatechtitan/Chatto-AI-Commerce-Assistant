'use strict';
// Reuse the production browser harness and isolated in-memory API, never real services.
process.env.CHATTO_CONTEXT_UI='1';
require('./responsive-ui.cjs');
