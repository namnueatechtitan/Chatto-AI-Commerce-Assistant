const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Exercise the pure URL guard without importing a server or reading environment secrets.
const source = fs.readFileSync(path.join(__dirname, "../lib/line-webhook-url.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, URL };
vm.runInNewContext(compiled, context);
const { publicLineWebhookUrl } = context.exports;

test("missing, invalid, private and placeholder URLs leave copying disabled", () => {
  for (const value of [undefined, "", "  ", "not a URL", "https://XXXXXXXXXXX", "http://hooks.chatto.app/webhooks/line",
    "https://localhost/webhooks/line", "https://127.0.0.1/webhooks/line", "https://10.0.0.1/webhooks/line",
    "https://192.168.1.1/webhooks/line", "https://[::1]/webhooks/line", "https://hooks.local/webhooks/line",
    "https://hooks.internal/webhooks/line", "https://hooks.test/webhooks/line", "https://hooks.invalid/webhooks/line",
    "https://hooks.example/webhooks/line", "https://example.com/webhooks/line", "https://hooks.example.org/webhooks/line",
    "https://user:password@hooks.chatto.app/webhooks/line", "https://hooks.chatto.app/webhooks/line?token=credential",
    "https://hooks.chatto.app/webhooks/line#fragment"]) {
    assert.equal(publicLineWebhookUrl(value), null);
  }
});

test("explicit HTTPS configuration with a public DNS hostname is preserved", () => {
  assert.equal(publicLineWebhookUrl("  https://hooks.chatto.app/webhooks/line  "), "https://hooks.chatto.app/webhooks/line");
});
