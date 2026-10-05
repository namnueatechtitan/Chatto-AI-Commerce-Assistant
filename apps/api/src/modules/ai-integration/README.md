# AI Integration Module

Direction:

```txt
apps/api -> apps/ai-service MCP endpoint
```

This module calls:

```txt
POST /mcp/chat
```

Configuration:

```env
AI_SERVICE_BASE_URL=http://localhost:5000
```

Provision `AI_SERVICE_TOKEN` privately with the same value in the API and AI
service. There is no default token: missing configuration rejects chat requests
before network calls. Do not use a published sample token or expose this credential
to the frontend. Existing local configuration has not been rotated by A2.

The API also verifies the response request, merchant and conversation IDs before
accepting an AI reply. See [Phase A2](../../../../../docs/architecture/phase-a2-security.md)
for the service trust boundary, validation results and pending approval decisions.
