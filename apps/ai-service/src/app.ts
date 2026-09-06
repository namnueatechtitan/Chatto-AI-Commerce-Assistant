import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ChatPipeline } from "./modules/chat-pipeline";
import { McpToolRegistry } from "./modules/mcp/tools";
import { chatSchema, assertMerchantContext, idSchema } from "./modules/mcp/schemas";
import { handleMcpRequest } from "./modules/mcp/server";
import { resources, resourceTemplates, readResource } from "./modules/mcp/resources";

function authorized(request: Request): boolean {
  const token = process.env.AI_SERVICE_TOKEN || "dev_internal_service_token";
  const actual = Buffer.from(request.get("Authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createApp(pipeline = new ChatPipeline()) {
  const app = express();
  const tools: McpToolRegistry = pipeline.tools;
  app.disable("x-powered-by");
  app.get("/health", (_request, response) => response.json({
    status: "ok", service: "chatto-ai-service", mode: "mcp-confidence-guardrail",
    modules: ["mcp", "rag", "confidence", "guardrails"],
  }));
  // All operational routes are service-to-service. Health remains public.
  app.use((request, response, next) => {
    if (!authorized(request)) { response.status(401).json({ error: { code: "UNAUTHORIZED" } }); return; }
    const origin = request.get("Origin");
    const allowedOrigins = (process.env.AI_SERVICE_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
    if (origin && !allowedOrigins.includes(origin)) { response.status(403).json({ error: { code: "ORIGIN_NOT_ALLOWED" } }); return; }
    const merchant = request.get("X-Merchant-Id");
    if (merchant && !idSchema.safeParse(merchant).success) { response.status(400).json({ error: { code: "INVALID_MERCHANT_ID" } }); return; }
    next();
  });
  app.use(express.json({ limit: "5mb" }));
  const manifest = () => ({ name: "chatto-phase-2-mcp", version: "0.3.0", phase: "phase-2", transport: "streamable-http", resources, resourceTemplates, tools: tools.list() });
  app.get("/mcp/manifest", (_request, response) => response.json(manifest()));
  app.get("/mcp/tools", (_request, response) => response.json({ tools: tools.list() }));
  app.get("/mcp/resources", (_request, response) => response.json({ resources, resourceTemplates }));
  app.post("/mcp/resources/read", async (request, response) => {
    try {
      const uri = z.string().min(1).parse(request.body?.uri);
      const value = await readResource(uri, request.get("X-Merchant-Id"), request.body?.ai_context);
      response.json({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value) }] });
    } catch { response.status(400).json({ error: { code: "INVALID_OR_UNAVAILABLE_RESOURCE" } }); }
  });
  app.post("/mcp/tools/:toolName/call", async (request, response) => {
    const name = request.params.toolName;
    const merchant = request.get("X-Merchant-Id");
    if (["chatto.build_context", "chatto.retrieve_knowledge"].includes(name) && !merchant) {
      response.status(400).json({ error: { code: "MERCHANT_SCOPE_REQUIRED" } }); return;
    }
    const result = await tools.call(name, request.body?.input, merchant);
    response.status(result.ok ? 200 : 400).json(result);
  });
  const chat = async (request: Request, response: Response) => {
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: { code: "BAD_AI_CHAT_REQUEST", fields: parsed.error.issues.map(issue => issue.path.join(".")) } }); return;
    }
    const body = parsed.data;
    try {
      const merchant = request.get("X-Merchant-Id");
      if (merchant && merchant !== body.merchant_id) throw new Error("MERCHANT_SCOPE_MISMATCH");
      assertMerchantContext(body.merchant_id, body.ai_context);
    } catch { response.status(400).json({ error: { code: "MERCHANT_SCOPE_MISMATCH" } }); return; }
    try { response.json(await pipeline.chat(body)); }
    catch { response.status(500).json({ error: { code: "AI_PIPELINE_FAILED", request_id: body.request_id } }); }
  };
  app.post(["/mcp/chat", "/ai/chat"], chat);
  app.post("/mcp", async (request, response) => {
    try { await handleMcpRequest(request, response, tools); }
    catch { if (!response.headersSent) response.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "MCP request failed" } }); }
  });
  app.all("/mcp", (_request, response) => response.status(405).set("Allow", "POST").end());
  // Deprecated debug endpoint no longer has a separate, unguarded pipeline.
  app.post("/mock-reply", chat);
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const status = typeof error === "object" && error !== null && "status" in error && error.status === 413 ? 413 : 400;
    response.status(status).json({ error: { code: status === 413 ? "REQUEST_TOO_LARGE" : "INVALID_JSON" } });
  };
  app.use(errors);
  return app;
}
