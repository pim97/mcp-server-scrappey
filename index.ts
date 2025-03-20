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

// Global State
const sessions = new Map<string, string>();
const consoleLogs: string[] = [];
const screenshots = new Map<string, string>();

// Scrappey API Configuration
// const SCRAPPEY_API_URL = "https://publisher.scrappey.com/api/v1";
const SCRAPPEY_API_URL = "http://localhost:80/v1";

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
  return response.session;
}

async function destroySession(sessionId: string) {
  await makeRequest("sessions.destroy", { session: sessionId });
}

// Tool Definitions
const TOOLS: Tool[] = [
  {
    name: "scrappey_create_session",
    description: "Create a new browser session using Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        proxy: { type: "string", description: "Optional proxy URL" },
        whitelistedDomains: { 
          type: "array", 
          items: { type: "string" },
          description: "Optional list of whitelisted domains"
        },
        browser: {
          type: "object",
          properties: {
            name: { type: "string", enum: ["chrome", "firefox", "safari"] },
            minVersion: { type: "number" },
            maxVersion: { type: "number" }
          }
        }
      },
      required: [],
    },
  },
  {
    name: "scrappey_close_session",
    description: "Close a browser session on Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "scrappey_navigate",
    description: "Navigate to a URL using Scrappey",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        sessionId: { type: "string" },
        customHeaders: { type: "object" },
        cookies: { type: "string" },
      },
      required: ["url", "sessionId"],
    },
  },
  {
    name: "scrappey_click",
    description: "Click an element on the page",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        selector: { type: "string" },
        wait: { type: "number" },
        waitForSelector: { type: "string" },
        when: { type: "string", enum: ["beforeload", "afterload"] },
        ignoreErrors: { type: "boolean" },
      },
      required: ["sessionId", "selector"],
    },
  },
  {
    name: "scrappey_type",
    description: "Type text into an input field",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        selector: { type: "string" },
        text: { type: "string" },
        wait: { type: "number" },
        when: { type: "string", enum: ["beforeload", "afterload"] },
        ignoreErrors: { type: "boolean" },
      },
      required: ["sessionId", "selector", "text"],
    },
  },
  {
    name: "scrappey_execute_js",
    description: "Execute JavaScript code on the page",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        code: { type: "string" },
      },
      required: ["sessionId", "code"],
    },
  },
  {
    name: "scrappey_solve_captcha",
    description: "Solve a captcha on the page",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        captchaType: { 
          type: "string", 
          enum: ["turnstile", "perimeterx", "recaptcha", "hcaptcha", "mtcaptcha", "custom"]
        },
        sitekey: { type: "string" },
        cssSelector: { type: "string" },
        inputSelector: { type: "string" },
        clickSelector: { type: "string" },
      },
      required: ["sessionId", "captchaType"],
    },
  },
  {
    name: "scrappey_wait",
    description: "Wait for a specified time or selector",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        seconds: { type: "number" },
        selector: { type: "string" },
        timeout: { type: "number" },
      },
      required: ["sessionId"],
    },
  },
];

// Tool Handler Implementation
async function handleToolCall(
  name: string,
  args: any
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "scrappey_create_session": {
        const sessionId = await createSession(args);
        sessions.set(sessionId, sessionId);
        return {
          content: [{ type: "text", text: `Created session: ${sessionId}` }],
          isError: false,
        };
      }

      case "scrappey_close_session": {
        await destroySession(args.sessionId);
        sessions.delete(args.sessionId);
        return {
          content: [{ type: "text", text: "Session closed successfully" }],
          isError: false,
        };
      }

      case "scrappey_navigate": {
        const response = await makeRequest("request.get", {
          session: args.sessionId,
          url: args.url,
          customHeaders: args.customHeaders,
          cookies: args.cookies,
        });
        return {
          content: [{ type: "text", text: `Navigated to ${args.url}` }],
          isError: false,
        };
      }

      case "scrappey_click": {
        await makeRequest("request.get", {
          session: args.sessionId,
          browserActions: [{
            type: "click",
            cssSelector: args.selector,
            wait: args.wait,
            waitForSelector: args.waitForSelector,
            when: args.when,
            ignoreErrors: args.ignoreErrors,
          }],
        });
        return {
          content: [{ type: "text", text: `Clicked element: ${args.selector}` }],
          isError: false,
        };
      }

      case "scrappey_type": {
        await makeRequest("request.get", {
          session: args.sessionId,
          browserActions: [{
            type: "type",
            cssSelector: args.selector,
            text: args.text,
            wait: args.wait,
            when: args.when,
            ignoreErrors: args.ignoreErrors,
          }],
        });
        return {
          content: [{ type: "text", text: `Typed text into ${args.selector}` }],
          isError: false,
        };
      }

      case "scrappey_execute_js": {
        const response = await makeRequest("request.get", {
          session: args.sessionId,
          browserActions: [{
            type: "execute_js",
            code: args.code,
          }],
        });
        return {
          content: [{ type: "text", text: `Executed JavaScript: ${response.result || "success"}` }],
          isError: false,
        };
      }

      case "scrappey_solve_captcha": {
        await makeRequest("request.get", {
          session: args.sessionId,
          browserActions: [{
            type: "solve_captcha",
            captcha: args.captchaType,
            captchaData: {
              sitekey: args.sitekey,
              cssSelector: args.cssSelector,
              inputSelector: args.inputSelector,
              clickSelector: args.clickSelector,
            },
          }],
        });
        return {
          content: [{ type: "text", text: "Solved captcha successfully" }],
          isError: false,
        };
      }

      case "scrappey_wait": {
        const action = args.selector ? {
          type: "wait_for_selector",
          cssSelector: args.selector,
          timeout: args.timeout,
        } : {
          type: "wait",
          wait: args.seconds,
        };

        await makeRequest("request.get", {
          session: args.sessionId,
          browserActions: [action],
        });
        return {
          content: [{ type: "text", text: "Wait completed" }],
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
  resources: [
    {
      uri: "console://logs",
      mimeType: "text/plain",
      name: "Browser console logs",
    },
    ...Array.from(screenshots.keys()).map((name) => ({
      uri: `screenshot://${name}`,
      mimeType: "image/png",
      name: `Screenshot: ${name}`,
    })),
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
  const uri = request.params.uri.toString();

  if (uri === "console://logs") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: consoleLogs.join("\n"),
        },
      ],
    };
  }

  if (uri.startsWith("screenshot://")) {
    const name = uri.split("://")[1];
    const screenshot = screenshots.get(name);
    if (screenshot) {
      return {
        contents: [
          {
            uri,
            mimeType: "image/png",
            blob: screenshot,
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
