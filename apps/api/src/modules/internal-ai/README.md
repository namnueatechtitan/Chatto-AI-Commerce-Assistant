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
```

Environment:

```env
INTERNAL_SERVICE_TOKEN=dev_internal_service_token
```
