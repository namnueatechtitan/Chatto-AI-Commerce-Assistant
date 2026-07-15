# AI Integration Module

Direction:

```txt
apps/api -> apps/ai-service MCP endpoint
```

This module calls:

```txt
POST /mcp/chat
```

Environment:

```env
AI_SERVICE_BASE_URL=http://localhost:5000
AI_SERVICE_TOKEN=dev_internal_service_token
```
