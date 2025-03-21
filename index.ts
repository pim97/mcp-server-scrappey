#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolResult,
  TextContent,
  ImageContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { config } from "dotenv";

config();

// Environment variables configuration
const requiredEnvVars = {
  SCRAPPEY_API_KEY: process.env.SCRAPPEY_API_KEY,
};

// Validate required environment variables
Object.entries(requiredEnvVars).forEach(([name, value]) => {
  if (!value) throw new Error(`${name} environment variable is required`);
});

const activeSessions = new Set<string>();

// Scrappey API Configuration
const SCRAPPEY_API_URL = "https://publisher.scrappey.com/api/v1";
// const SCRAPPEY_API_URL = "http://localhost:80/v1";

// Helper Functions
async function makeRequest(cmd: string, params: any) {
  try {
    const response = await axios.post(
      `${SCRAPPEY_API_URL}?key=${process.env.SCRAPPEY_API_KEY}`,
      {
        cmd,
        ...params,
      },
      {
        timeout: 180000, // 3 minutes timeout in milliseconds
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Scrappey API error: ${(error as Error).message}`);
  }
}

async function createSession(params: any = {}) {
  const response = await makeRequest("sessions.create", params);
  const sessionId = response.session;
  activeSessions.add(sessionId);
  return sessionId;
}

async function destroySession(sessionId: string) {
  await makeRequest("sessions.destroy", { session: sessionId });
  activeSessions.delete(sessionId);
}

// Tool Definitions
const TOOLS: Tool[] = [
  {
    name: "scrappey_create_session",
    description: "Create a new browser session in Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        proxy: { type: "string", description: "Use with http://user:pass@ip:port, keep blank to use in built proxy, which is fine for most use cases" }
      }
    }
  },
  {
    name: "scrappey_destroy_session",
    description: "Destroy an existing browser session in Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string" }
      },
      required: ["session"]
    }
  },
  {
    name: "scrappey_request",
    description: "Send a request using Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string", enum: ["request.get", "request.post", "request.put", "request.delete", "request.patch"] },
        url: { type: "string" },
        filter: { type: "array", items: { type: "enum", enum: ["innerText", "userAgent", "statusCode", "cookies", "cookieString", "responseHeaders", "requestHeaders", "ipInfo"] }, description: "Filter the response to only include the specified fields to make the respone shorter and more efficient" },
        session: { type: "string" },
        postData: { type: "string" },
        customHeaders: { type: "object" }
      },
      required: ["url", "cmd", "session", "filter"]
    }
  },
  {
    name: "scrappey_browser_action",
    description: "Execute browser actions in a session",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string" },
        url: { type: "string" },
        filter: { type: "array", items: { type: "enum", enum: ["innerText", "userAgent", "statusCode", "cookies", "cookieString", "responseHeaders", "requestHeaders", "ipInfo"] }, description: "Filter the response to only include the specified fields to make the respone shorter and more efficient" },
        keepSamePage: { type: "boolean", description: "Keep the same page before performing the browser actions" },
        cmd: { type: "string", enum: ["request.get", "request.post", "request.put", "request.delete", "request.patch"] },
        browserActions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["click", "hover", "type", "scroll", "wait"] },
              cssSelector: { type: "string" },
              text: { type: "string" },
              code: { type: "string" },
              wait: { type: "number" },
              url: { type: "string" }
            },
            required: ["type"]
          }
          }
        },
      required: ["session", "browserActions", "filter"]
    }
  }
];

// Tool Handler Implementation
async function handleToolCall(
  name: string,
  args: any
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "scrappey_create_session": {
        const session = await createSession(args);
        return {
          content: [{ type: "text", text: `Created session: ${session}` }],
          isError: false,
        };
      }

      case "scrappey_destroy_session": {
        await destroySession(args.session);
        return {
          content: [{ type: "text", text: `Destroyed session: ${args.session}` }],
          isError: false,
        };
      }

      case "scrappey_request": {
        const { url, cmd, session, postData, customHeaders, filter } = args;
        const params: any = { url, filter, session, postData, customHeaders };

        const response = await makeRequest(cmd, params);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
          isError: false,
        };
      }

      case "scrappey_browser_action": {
        const { session, browserActions, filter } = args;
        const response = await makeRequest("request.get", {
          session,
          browserActions,
          filter
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

// Server Setup
const server = new Server(
  {
    name: "example-servers/scrappey",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Request Handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: Array.from(activeSessions).map(sessionId => ({
    uri: `session://${sessionId}`,
    mimeType: "text/plain",
    name: `Active Session: ${sessionId}`,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
  const uri = request.params.uri.toString();

  if (uri.startsWith("session://")) {
    const sessionId = uri.split("://")[1];
    if (activeSessions.has(sessionId)) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `Active session ID: ${sessionId}`,
          },
        ],
      };
    }
  }

  throw new Error(`Resource not found: ${uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) =>
  handleToolCall(request.params.name, request.params.arguments ?? {})
);

// Server Initialization
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error); 
