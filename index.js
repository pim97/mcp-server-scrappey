#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
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
    if (!value)
        throw new Error(`${name} environment variable is required`);
});
const activeSessions = new Set();
// Scrappey API Configuration
const SCRAPPEY_API_URL = "https://publisher.scrappey.com/api/v1";
// const SCRAPPEY_API_URL = "http://localhost:80/v1";
// Helper Functions
async function makeRequest(cmd, params) {
    try {
        const response = await axios.post(`${SCRAPPEY_API_URL}?key=${process.env.SCRAPPEY_API_KEY}`, {
            cmd,
            ...params,
        }, {
            timeout: 180000,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        });
        return response.data;
    }
    catch (error) {
        throw new Error(`Scrappey API error: ${error.message}`);
    }
}
async function createSession(params = {}) {
    const response = await makeRequest("sessions.create", params);
    const sessionId = response.session;
    activeSessions.add(sessionId);
    return sessionId;
}
async function destroySession(sessionId) {
    await makeRequest("sessions.destroy", { session: sessionId });
    activeSessions.delete(sessionId);
}
// Tool Definitions
const TOOLS = [
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
                // filter: { type: "array", items: { type: "enum", enum: ["response", "innerText", "includeLinks", "includeImages", "userAgent", "statusCode", "cookies", "cookieString", "responseHeaders", "requestHeaders", "ipInfo"] }, description: "Filter the response to only include the specified fields to make the respone shorter and more efficient. Response is full HTML, innerText is just the text. Only use repsonse when you need HTML elements." },
                session: { type: "string" },
                // includeLinks: { type: "boolean", description: "Include all links in the response of the page" },
                // includeImages: { type: "boolean", description: "Include all images in the response of the page" },
                postData: { type: "string" },
                customHeaders: { type: "object" }
            },
            required: ["url", "cmd", "session"]
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
                // filter: { type: "array", items: { type: "enum", enum: ["response", "innerText", "includeLinks", "includeImages", "userAgent", "statusCode", "cookies", "cookieString", "responseHeaders", "requestHeaders", "ipInfo"] }, description: "Filter the response to only include the specified fields to make the respone shorter and more efficient. Response is full HTML, innerText is just the text. Only use repsonse when you need HTML elements." },
                keepSamePage: { type: "boolean", description: "Keep the same page before performing the browser actions" },
                cmd: { type: "string", enum: ["request.get", "request.post", "request.put", "request.delete", "request.patch"] },
                browserActions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["click", "hover", "type", "scroll", "wait", "goto", "execute_js"] },
                            cssSelector: { type: "string", description: "CSS selector to use for the action, such as #id, .class, tag, etc. for click, type, hover, scroll, goto, execute_js" },
                            text: { type: "string", description: "Text to type, only used for type action" },
                            code: { type: "string", description: "Javascript code to execute, only used for execute_js action" },
                            wait: { type: "number", description: "Wait for the specified number of seconds before performing the next action" },
                            url: { type: "string", description: "URL to navigate to, only used for goto action" }
                        },
                        required: ["type"]
                    }
                }
            },
            required: ["session", "browserActions"]
        }
    }
];
// Tool Handler Implementation
async function handleToolCall(name, args) {
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
                const params = { url, filter, session, postData, customHeaders };
                const response = await makeRequest(cmd, params);
                const result = {
                    markdown: "",
                };
                if (response?.solution?.response) {
                    // Add CSS selectors as comments before converting to markdown
                    const dom = new DOMParser().parseFromString(response.solution.response, 'text/html');
                    // Add selectors to links
                    dom.querySelectorAll('a').forEach(link => {
                        const selector = getCssSelector(link);
                        link.textContent = `${link.textContent} <!-- selector: ${selector} -->`;
                    });
                    // Add selectors to buttons
                    dom.querySelectorAll('button').forEach(button => {
                        const selector = getCssSelector(button);
                        button.textContent = `${button.textContent} <!-- selector: ${selector} -->`;
                    });
                    // Add selectors to input fields
                    dom.querySelectorAll('input').forEach(input => {
                        const selector = getCssSelector(input);
                        input.setAttribute('placeholder', `${input.getAttribute('placeholder') || ''} <!-- selector: ${selector} -->`);
                    });
                    const nhm = new NodeHtmlMarkdown({
                        keepDataImages: true,
                        // keepComments: true // Ensure HTML comments are preserved
                    }, 
                    /* customTransformers (optional) */ undefined, 
                    /* customCodeBlockTranslators (optional) */ undefined);
                    result.markdown = nhm.translate(dom.documentElement.outerHTML);
                }
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
                const result = {
                    markdown: "",
                };
                if (response?.solution?.response) {
                    // Add CSS selectors as comments before converting to markdown
                    const dom = new DOMParser().parseFromString(response.solution.response, 'text/html');
                    // Add selectors to links
                    dom.querySelectorAll('a').forEach(link => {
                        const selector = getCssSelector(link);
                        link.textContent = `${link.textContent} <!-- selector: ${selector} -->`;
                    });
                    // Add selectors to buttons
                    dom.querySelectorAll('button').forEach(button => {
                        const selector = getCssSelector(button);
                        button.textContent = `${button.textContent} <!-- selector: ${selector} -->`;
                    });
                    // Add selectors to input fields
                    dom.querySelectorAll('input').forEach(input => {
                        const selector = getCssSelector(input);
                        input.setAttribute('placeholder', `${input.getAttribute('placeholder') || ''} <!-- selector: ${selector} -->`);
                    });
                    const nhm = new NodeHtmlMarkdown({
                        keepDataImages: true,
                        // keepComments: true // Ensure HTML comments are preserved
                    }, 
                    /* customTransformers (optional) */ undefined, 
                    /* customCodeBlockTranslators (optional) */ undefined);
                    result.markdown = nhm.translate(dom.documentElement.outerHTML);
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
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
}
// Server Setup
const server = new Server({
    name: "example-servers/scrappey",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Request Handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: Array.from(activeSessions).map(sessionId => ({
        uri: `session://${sessionId}`,
        mimeType: "text/plain",
        name: `Active Session: ${sessionId}`,
    })),
}));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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
server.setRequestHandler(CallToolRequestSchema, async (request) => handleToolCall(request.params.name, request.params.arguments ?? {}));
// Server Initialization
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
runServer().catch(console.error);
// Helper function to get a unique CSS selector for an element
function getCssSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    if (element.className) {
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
