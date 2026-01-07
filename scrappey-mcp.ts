#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { config } from "dotenv";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { JSDOM } from 'jsdom';
const { DOMParser } = new JSDOM().window;

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

// Error code descriptions for better debugging
const ERROR_CODES: Record<string, string> = {
  "CODE-0001": "All server capacity is used, please try again",
  "CODE-0002": "Cloudflare blocked",
  "CODE-0003": "Cloudflare too many attempts, try again",
  "CODE-0004": "Cloudflare not solvable using these settings",
  "CODE-0005": "Tunnel connection failed",
  "CODE-0006": "ERR_HTTP_RESPONSE_CODE_FAILURE",
  "CODE-0007": "Could not click turnstile button / Proxy error",
  "CODE-0008": "Ticketmaster blocked",
  "CODE-0009": "Error from ChatGPT/AI service, try again",
  "CODE-0010": "Blocked proxy on Datadome, please try again",
  "CODE-0011": "Could not solve datadome, please try again",
  "CODE-0012": "Could not parse datadome cookie, please try again",
  "CODE-0014": "Could not load datadome, please try again",
  "CODE-0015": "Socks4 With Authentication not Supported",
  "CODE-0016": "Socks5 With Authentication not Supported",
  "CODE-0017": "Cloudflare updated and is currently not solvable",
  "CODE-0018": "Too high error rate for this URL",
  "CODE-0019": "The proxy server is refusing connections",
  "CODE-0020": "Could not find intercept request, please try again",
  "CODE-0021": "Unknown error occurred with request",
  "CODE-0022": "Captcha type solve_captcha is not found",
  "CODE-0023": "Turnstile solve_captcha was not found",
  "CODE-0024": "Proxy timeout - proxy too slow",
  "CODE-0025": "NS_ERROR_NET_TIMEOUT - proxy too slow",
  "CODE-0026": "Internal browser error, please try again",
  "CODE-0027": "No elements found for this CSS selector",
  "CODE-0028": "Could not solve perimeterx, please try again",
  "CODE-0029": "Too many sessions open",
  "CODE-0030": "Browser name must be: firefox, chrome or safari",
  "CODE-0031": "Request error, please try again",
  "CODE-0032": "Turnstile captcha could not be solved",
  "CODE-0033": "Mt captcha could not be solved",
  "CODE-0034": "Datadome captcha could not be solved after 5 attempts",
  "CODE-0035": "Could not load geetest",
  "CODE-0036": "Keyboard action value not found",
  "CODE-0037": "Datadome was blocked, please try again with different proxy",
  "CODE-0038": "Could not solve FingerprintJS challenge",
};

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
        timeout: 180000, // 3 minutes timeout
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data;
      const errorCode = apiError.error || "";
      const errorDescription = ERROR_CODES[errorCode] || apiError.error || "Unknown error";
      throw new Error(`Scrappey API error [${errorCode}]: ${errorDescription}`);
    }
    throw new Error(`Scrappey API error: ${(error as Error).message}`);
  }
}

function parseApiResponse(response: any): { success: boolean; data: any; error?: string } {
  if (response.data === "error") {
    const errorCode = response.error || "UNKNOWN";
    const errorDescription = ERROR_CODES[errorCode] || response.error || "Unknown error";
    return {
      success: false,
      data: response,
      error: `[${errorCode}]: ${errorDescription}`,
    };
  }
  return { success: true, data: response };
}

async function createSession(params: any = {}) {
  const response = await makeRequest("sessions.create", params);
  const parsed = parseApiResponse(response);
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  const sessionId = response.session;
  activeSessions.add(sessionId);
  return { sessionId, fingerprint: response.fingerprint };
}

async function destroySession(sessionId: string) {
  const response = await makeRequest("sessions.destroy", { session: sessionId });
  activeSessions.delete(sessionId);
  return response;
}

async function listSessions() {
  const response = await makeRequest("sessions.list", {});
  return response;
}

async function checkSessionActive(sessionId: string) {
  const response = await makeRequest("sessions.active", { session: sessionId });
  return response;
}

// Common schema properties for proxy settings
const proxyProperties = {
  proxy: { 
    type: "string", 
    description: "Proxy in format http://user:pass@ip:port. Leave blank to use built-in proxy." 
  },
  proxyCountry: { 
    type: "string", 
    description: "Request proxy from specific country (e.g., 'UnitedStates', 'Germany', 'UnitedKingdom')" 
  },
  premiumProxy: { 
    type: "boolean", 
    description: "Use premium residential-like proxies for better success rates" 
  },
  mobileProxy: { 
    type: "boolean", 
    description: "Use mobile carrier proxies" 
  },
  noProxy: { 
    type: "boolean", 
    description: "Disable proxy usage entirely" 
  },
};

// Common schema properties for antibot bypass
const antibotProperties = {
  cloudflareBypass: { 
    type: "boolean", 
    description: "Enable Cloudflare-specific bypass" 
  },
  datadomeBypass: { 
    type: "boolean", 
    description: "Enable Datadome bypass using specialized solver" 
  },
  kasadaBypass: { 
    type: "boolean", 
    description: "Enable Kasada bypass" 
  },
  disableAntiBot: { 
    type: "boolean", 
    description: "Disable automatic antibot detection" 
  },
};

// Common schema properties for captcha solving
const captchaProperties = {
  automaticallySolveCaptchas: { 
    type: "boolean", 
    description: "Automatically detect and solve captchas on the page" 
  },
  alwaysLoad: { 
    type: "array", 
    items: { type: "string" },
    description: "Always load specific captcha types: 'recaptcha', 'hcaptcha', 'turnstile'" 
  },
};

// Common schema properties for response options
const responseProperties = {
  cssSelector: { 
    type: "string", 
    description: "Extract content matching this CSS selector" 
  },
  innerText: { 
    type: "boolean", 
    description: "Include inner text of page elements" 
  },
  includeImages: { 
    type: "boolean", 
    description: "Include all image URLs in the response" 
  },
  includeLinks: { 
    type: "boolean", 
    description: "Include all link URLs in the response" 
  },
  screenshot: { 
    type: "boolean", 
    description: "Capture page screenshot" 
  },
  screenshotWidth: { 
    type: "number", 
    description: "Screenshot width in pixels" 
  },
  screenshotHeight: { 
    type: "number", 
    description: "Screenshot height in pixels" 
  },
  filter: { 
    type: "array", 
    items: { type: "string" },
    description: "Return only specified fields: 'response', 'cookies', 'statusCode', 'innerText', etc." 
  },
  video: {
    type: "boolean",
    description: "Record browser session as video"
  },
  pdf: {
    type: "boolean",
    description: "Generate PDF of the page"
  },
};

// Common schema properties for request interception
const interceptionProperties = {
  interceptFetchRequest: { 
    type: "string", 
    description: "URL pattern to intercept and return response data" 
  },
  abortOnDetection: { 
    type: "array", 
    items: { type: "string" },
    description: "URL patterns to block (e.g., analytics, tracking scripts)" 
  },
  whitelistedDomains: { 
    type: "array", 
    items: { type: "string" },
    description: "Only allow requests to these domains" 
  },
  blackListedDomains: { 
    type: "array", 
    items: { type: "string" },
    description: "Block requests to these domains" 
  },
  blockCookieBanners: {
    type: "boolean",
    description: "Automatically block cookie consent banners"
  },
};

// Advanced options
const advancedProperties = {
  customHeaders: { 
    type: "object", 
    description: "Custom HTTP headers to send" 
  },
  cookies: {
    type: "string",
    description: "Cookie string to set"
  },
  cookiejar: {
    type: "array",
    description: "Cookie jar array format"
  },
  localStorage: {
    type: "object",
    description: "LocalStorage data to set"
  },
  referer: {
    type: "string",
    description: "HTTP Referer header value"
  },
  userAgent: {
    type: "string",
    description: "Custom user agent string"
  },
  timeout: {
    type: "number",
    description: "Request timeout in milliseconds"
  },
  retries: {
    type: "number",
    description: "Number of retry attempts on failure"
  },
  fullPageLoad: {
    type: "boolean",
    description: "Wait for full page load"
  },
  listAllRedirects: {
    type: "boolean",
    description: "Track and return all redirect URLs"
  },
  removeIframes: {
    type: "boolean",
    description: "Remove all iframes from page"
  },
};

// Browser action schema definition
const browserActionSchema = {
  type: "object",
  properties: {
    type: { 
      type: "string", 
      enum: [
        "click", "type", "goto", "wait", "wait_for_selector", "wait_for_function",
        "wait_for_load_state", "wait_for_cookie", "execute_js", "scroll", "hover",
        "keyboard", "dropdown", "switch_iframe", "set_viewport", "if", "while",
        "solve_captcha", "remove_iframes"
      ],
      description: "The type of browser action to perform"
    },
    cssSelector: { 
      type: "string", 
      description: "CSS selector for click, type, hover, scroll, dropdown, switch_iframe actions" 
    },
    text: { 
      type: "string", 
      description: "Text to type (for 'type' action)" 
    },
    code: { 
      type: "string", 
      description: "JavaScript code to execute (for 'execute_js' or 'wait_for_function')" 
    },
    wait: { 
      type: "number", 
      description: "Wait time in milliseconds after action" 
    },
    waitForSelector: { 
      type: "string", 
      description: "Wait for this selector after action completes" 
    },
    url: { 
      type: "string", 
      description: "URL for 'goto' action" 
    },
    timeout: { 
      type: "number", 
      description: "Timeout in milliseconds (default: 60000)" 
    },
    // wait_for_load_state specific
    waitForLoadState: { 
      type: "string", 
      enum: ["domcontentloaded", "networkidle", "load"],
      description: "Page load state to wait for" 
    },
    // wait_for_cookie specific
    cookieName: { 
      type: "string", 
      description: "Cookie name to wait for" 
    },
    cookieValue: { 
      type: "string", 
      description: "Expected cookie value (optional)" 
    },
    cookieDomain: { 
      type: "string", 
      description: "Cookie domain to check" 
    },
    pollIntervalMs: {
      type: "number",
      description: "Poll interval for wait_for_cookie (default: 200ms)"
    },
    // keyboard specific
    value: { 
      type: "string", 
      enum: ["tab", "enter", "space", "arrowdown", "arrowup", "arrowleft", "arrowright", "backspace", "clear"],
      description: "Key to press for 'keyboard' action" 
    },
    // dropdown specific
    index: { 
      type: "number", 
      description: "Option index to select in dropdown" 
    },
    // scroll specific
    repeat: { 
      type: "number", 
      description: "Number of times to repeat scroll" 
    },
    delayMs: { 
      type: "number", 
      description: "Delay between scroll actions in ms" 
    },
    // set_viewport specific
    width: { 
      type: "number", 
      description: "Viewport width (default: 1280)" 
    },
    height: { 
      type: "number", 
      description: "Viewport height (default: 1024)" 
    },
    // if/while specific
    condition: { 
      type: "string", 
      description: "JavaScript condition to evaluate" 
    },
    then: { 
      type: "array", 
      description: "Actions to run if condition is true" 
    },
    or: { 
      type: "array", 
      description: "Actions to run if condition is false (for 'if' action)" 
    },
    maxAttempts: { 
      type: "number", 
      description: "Maximum iterations for 'while' action" 
    },
    // solve_captcha specific
    captcha: { 
      type: "string", 
      enum: ["turnstile", "recaptcha", "recaptchav2", "recaptchav3", "hcaptcha", "hcaptcha_inside", 
             "hcaptcha_enterprise_inside", "funcaptcha", "perimeterx", "mtcaptcha", "mtcaptchaisolated",
             "v4guard", "custom", "fingerprintjscom", "fingerprintjs_curseforge"],
      description: "Type of captcha to solve" 
    },
    captchaData: { 
      type: "object", 
      description: "Additional captcha data (sitekey, action, cssSelector, reset, fast, etc.)" 
    },
    websiteUrl: { 
      type: "string", 
      description: "Website URL for captcha solving" 
    },
    websiteKey: { 
      type: "string", 
      description: "Site key for captcha" 
    },
    inputSelector: {
      type: "string",
      description: "Input selector to put captcha answer"
    },
    clickSelector: {
      type: "string",
      description: "Button selector to click after captcha solve"
    },
    iframeSelector: {
      type: "string",
      description: "Iframe selector containing captcha"
    },
    // Common options
    when: { 
      type: "string", 
      enum: ["beforeload", "afterload"],
      description: "When to execute: 'beforeload' or 'afterload'" 
    },
    ignoreErrors: { 
      type: "boolean", 
      description: "Continue execution if action fails" 
    },
    direct: { 
      type: "boolean", 
      description: "Use direct action instead of cursor simulation" 
    },
  },
  required: ["type"]
};

// Tool Definitions
const TOOLS: Tool[] = [
  {
    name: "scrappey_create_session",
    description: "Create a new browser session in Scrappey. Sessions persist browser state (cookies, localStorage) across requests.",
    inputSchema: {
      type: "object",
      properties: {
        ...proxyProperties,
        browser: {
          type: "array",
          description: "Browser specification: [{\"name\": \"firefox\", \"minVersion\": 120, \"maxVersion\": 130}]"
        },
        userAgent: {
          type: "string",
          description: "Custom user agent string"
        },
        locales: {
          type: "array",
          items: { type: "string" },
          description: "Browser locale settings (e.g., ['en-US', 'en'])"
        },
      }
    }
  },
  {
    name: "scrappey_destroy_session",
    description: "Destroy an existing browser session in Scrappey to free resources",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: "Session ID to destroy" }
      },
      required: ["session"]
    }
  },
  {
    name: "scrappey_list_sessions",
    description: "List all active sessions for the current user",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "scrappey_session_active",
    description: "Check if a specific session is currently active",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: "Session ID to check" }
      },
      required: ["session"]
    }
  },
  {
    name: "scrappey_request",
    description: "Send an HTTP request using Scrappey with antibot bypass capabilities. Supports GET, POST, PUT, DELETE, PATCH methods.",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { 
          type: "string", 
          enum: ["request.get", "request.post", "request.put", "request.delete", "request.patch"],
          description: "HTTP method to use"
        },
        url: { type: "string", description: "Target URL to request" },
        session: { type: "string", description: "Session ID for session persistence" },
        postData: { 
          type: "object", 
          description: "Data to send with POST/PUT/PATCH requests" 
        },
        ...proxyProperties,
        ...antibotProperties,
        ...captchaProperties,
        ...responseProperties,
        ...interceptionProperties,
        ...advancedProperties,
      },
      required: ["url", "cmd"]
    }
  },
  {
    name: "scrappey_browser_action",
    description: "Execute browser automation actions in a session. Supports clicking, typing, scrolling, waiting, JavaScript execution, captcha solving, and more.",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: "Session ID to use" },
        url: { type: "string", description: "URL to navigate to before actions" },
        cmd: { 
          type: "string", 
          enum: ["request.get", "request.post", "request.put", "request.delete", "request.patch"],
          description: "HTTP method for initial navigation"
        },
        browserActions: {
          type: "array",
          items: browserActionSchema,
          description: "Array of browser actions to execute sequentially"
        },
        ...proxyProperties,
        ...antibotProperties,
        ...captchaProperties,
        ...responseProperties,
        ...interceptionProperties,
        mouseMovements: {
          type: "boolean",
          description: "Enable human-like mouse movements"
        },
        forceMouseMovement: {
          type: "boolean",
          description: "Force mouse movement simulation"
        },
      },
      required: ["session", "browserActions", "url", "cmd"]
    }
  },
  {
    name: "scrappey_screenshot",
    description: "Take a screenshot of a webpage. Optionally execute browser actions before capturing.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to screenshot" },
        session: { type: "string", description: "Optional session ID to use" },
        screenshotWidth: { type: "number", description: "Screenshot width in pixels (default: 1920)" },
        screenshotHeight: { type: "number", description: "Screenshot height in pixels (default: 1080)" },
        fullPage: { type: "boolean", description: "Capture full page instead of viewport" },
        browserActions: {
          type: "array",
          items: browserActionSchema,
          description: "Optional actions to execute before screenshot"
        },
        ...proxyProperties,
        ...antibotProperties,
      },
      required: ["url"]
    }
  },
];

// Helper function to process HTML response to markdown
function processHtmlToMarkdown(html: string): string {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  
  // Add selectors to links
  dom.querySelectorAll('a').forEach((link: Element) => {
    const selector = getCssSelector(link);
    link.textContent = `${link.textContent} <!-- selector: ${selector} -->`;
  });

  // Add selectors to buttons
  dom.querySelectorAll('button').forEach((button: Element) => {
    const selector = getCssSelector(button);
    button.textContent = `${button.textContent} <!-- selector: ${selector} -->`;
  });

  // Add selectors to input fields
  dom.querySelectorAll('input').forEach((input: Element) => {
    const selector = getCssSelector(input);
    input.setAttribute('placeholder', `${input.getAttribute('placeholder') || ''} <!-- selector: ${selector} -->`);
  });

  // Add selectors to textareas
  dom.querySelectorAll('textarea').forEach((textarea: Element) => {
    const selector = getCssSelector(textarea);
    textarea.setAttribute('placeholder', `${textarea.getAttribute('placeholder') || ''} <!-- selector: ${selector} -->`);
  });

  // Add selectors to select elements
  dom.querySelectorAll('select').forEach((select: Element) => {
    const selector = getCssSelector(select);
    const label = select.getAttribute('name') || select.getAttribute('id') || 'dropdown';
    select.insertAdjacentHTML('beforebegin', `<!-- ${label} selector: ${selector} -->`);
  });

  const nhm = new NodeHtmlMarkdown(
    { keepDataImages: true },
    undefined,
    undefined
  );
  
  return nhm.translate(dom.documentElement.outerHTML);
}

// Build result object from API response
function buildResult(response: any): any {
  const result: any = {};

  if (response?.solution?.response) {
    result.markdown = processHtmlToMarkdown(response.solution.response);
  }

  if (response?.solution?.statusCode) {
    result.statusCode = response.solution.statusCode;
  }

  if (response?.solution?.currentUrl) {
    result.currentUrl = response.solution.currentUrl;
  }

  if (response?.solution?.cookies) {
    result.cookies = response.solution.cookies;
  }

  if (response?.solution?.screenshot) {
    result.screenshot = response.solution.screenshot;
  }

  if (response?.solution?.screenshotUrl) {
    result.screenshotUrl = response.solution.screenshotUrl;
  }

  if (response?.solution?.videoUrl) {
    result.videoUrl = response.solution.videoUrl;
  }

  if (response?.solution?.javascriptReturn) {
    result.javascriptReturn = response.solution.javascriptReturn;
  }

  if (response?.solution?.interceptFetchRequestResponse) {
    result.interceptedRequest = response.solution.interceptFetchRequestResponse;
  }

  if (response?.solution?.innerText) {
    result.innerText = response.solution.innerText;
  }

  if (response?.solution?.detectedAntibotProviders) {
    result.detectedAntibotProviders = response.solution.detectedAntibotProviders;
  }

  if (response?.solution?.additionalCost) {
    result.additionalCost = response.solution.additionalCost;
  }

  if (response?.solution?.listAllRedirectsResponse) {
    result.redirects = response.solution.listAllRedirectsResponse;
  }

  if (response?.solution?.captchaSolveResult) {
    result.captchaSolveResult = response.solution.captchaSolveResult;
  }

  return result;
}

// Tool Handler Implementation
async function handleToolCall(
  name: string,
  args: any
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "scrappey_create_session": {
        const { sessionId, fingerprint } = await createSession(args);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              session: sessionId, 
              fingerprint,
              message: "Session created successfully. Use this session ID for subsequent requests." 
            }, null, 2) 
          }],
          isError: false,
        };
      }

      case "scrappey_destroy_session": {
        await destroySession(args.session);
        return {
          content: [{ type: "text", text: `Session ${args.session} destroyed successfully.` }],
          isError: false,
        };
      }

      case "scrappey_list_sessions": {
        const response = await listSessions();
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              sessions: response.sessions || [],
              open: response.open || 0,
              limit: response.limit || 100,
            }, null, 2) 
          }],
          isError: false,
        };
      }

      case "scrappey_session_active": {
        const response = await checkSessionActive(args.session);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              session: args.session, 
              active: response.active || false 
            }, null, 2) 
          }],
          isError: false,
        };
      }

      case "scrappey_request": {
        const { cmd, ...params } = args;
        const response = await makeRequest(cmd, params);
        const parsed = parseApiResponse(response);
        
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: `Request failed: ${parsed.error}` }],
            isError: true,
          };
        }

        const result = buildResult(response);
        result.session = response.session;

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      }

      case "scrappey_browser_action": {
        const { cmd, ...params } = args;
        const response = await makeRequest(cmd, params);
        const parsed = parseApiResponse(response);
        
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: `Browser action failed: ${parsed.error}` }],
            isError: true,
          };
        }

        const result = buildResult(response);
        result.session = response.session;

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      }

      case "scrappey_screenshot": {
        const { url, session, screenshotWidth, screenshotHeight, fullPage, browserActions, ...proxyArgs } = args;
        
        const params: any = {
          url,
          screenshot: true,
          screenshotUpload: true,
          ...proxyArgs,
        };

        if (session) params.session = session;
        if (screenshotWidth) params.screenshotWidth = screenshotWidth;
        if (screenshotHeight) params.screenshotHeight = screenshotHeight;
        if (browserActions) params.browserActions = browserActions;

        const response = await makeRequest("request.get", params);
        const parsed = parseApiResponse(response);
        
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: `Screenshot failed: ${parsed.error}` }],
            isError: true,
          };
        }

        const result: any = {
          success: true,
          currentUrl: response.solution?.currentUrl,
        };

        if (response.solution?.screenshot) {
          result.screenshot = response.solution.screenshot;
        }
        if (response.solution?.screenshotUrl) {
          result.screenshotUrl = response.solution.screenshotUrl;
        }
        if (response.session) {
          result.session = response.session;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
    const errorMessage = (error as Error).message;
    // Check if error contains a known error code
    const codeMatch = errorMessage.match(/CODE-\d{4}/);
    const codeInfo = codeMatch ? ERROR_CODES[codeMatch[0]] : null;
    
    return {
      content: [{ 
        type: "text", 
        text: `Error: ${errorMessage}${codeInfo ? `\nHint: ${codeInfo}` : ''}` 
      }],
      isError: true,
    };
  }
}

// Server Setup
const server = new Server(
  {
    name: "scrappey-mcp",
    version: "2.0.0",
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

// Helper function to get a unique CSS selector for an element
function getCssSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c);
    if (classes.length > 0) {
      return `.${classes.join('.')}`;
    }
  }
  
  let selector = element.tagName.toLowerCase();
  if (element.hasAttribute('name')) {
    selector += `[name="${element.getAttribute('name')}"]`;
  }
  
  return selector;
}

