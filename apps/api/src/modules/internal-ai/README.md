# Internal AI Module

Direction:

```txt
apps/api -> AI context exports for MCP requests
```

Endpoints:

```txt
GET /internal/ai/products/export?merchant_id=<merchantId>
GET /internal/ai/knowledge-base/export?merchant_id=<merchantId>
GET /internal/ai/vector-documents/export?merchant_id=<merchantId>
GET /internal/ai/merchant-settings/<merchantId>
POST /internal/ai/vector-documents/sync
```

Environment:

Provision `INTERNAL_SERVICE_TOKEN` privately and send it in the Bearer header.
There is no embedded development-token fallback. Missing configuration fails
closed with 503; invalid/missing authentication returns 401 before DTO validation.
Every export requires a UUID tenant parameter; vector sync validates its runtime
payload and immutable document/source ownership within a transaction. Credentials
are platform-service credentials and must never be used in frontend code.

The detailed trust policy, endpoint matrix and migration proposals are in
[Phase A2](../../../../../docs/architecture/phase-a2-security.md).
