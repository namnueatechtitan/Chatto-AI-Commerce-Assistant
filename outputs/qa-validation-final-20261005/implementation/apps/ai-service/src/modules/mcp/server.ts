import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import { McpToolRegistry } from "./tools";
import { resources, resourceTemplates, readResource } from "./resources";

export function createMcpServer(tools: McpToolRegistry, merchantId?: string): Server {
  const server = new Server({ name: "chatto-phase-2-mcp", version: "0.3.0" }, {
    capabilities: { tools: {}, resources: {} },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.list() }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (["chatto.build_context", "chatto.retrieve_knowledge"].includes(request.params.name) && !merchantId) {
      throw new McpError(ErrorCode.InvalidParams, "X-Merchant-Id is required for this tool");
    }
    const result = await tools.call(request.params.name, request.params.arguments ?? {}, merchantId);
    return {
      content: [{ type: "text", text: JSON.stringify(result.ok ? result.output : { error: result.error }) }],
      isError: !result.ok,
    };
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates }));
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    try {
      const value = await readResource(request.params.uri, merchantId);
      return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(value) }] };
    } catch {
      throw new McpError(ErrorCode.InvalidParams, "Resource unavailable or outside merchant scope");
    }
  });
  return server;
}

/** Stateless Streamable HTTP: SDK owns initialize, notifications and JSON-RPC. */
export async function handleMcpRequest(request: Request, response: Response, tools: McpToolRegistry): Promise<void> {
  const server = createMcpServer(tools, request.get("X-Merchant-Id"));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  response.once("close", () => {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  });
  await server.connect(transport);
  await transport.handleRequest(request, response, request.body);
}
