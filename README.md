# Scrappey MCP Server

A Model Context Protocol (MCP) server for interacting with Scrappey.com's web automation and scraping capabilities. Try it out directly at [smithery.ai/server/@pim97/mcp-server-scrappey](https://smithery.ai/server/@pim97/mcp-server-scrappey).

## Overview

This MCP server provides a bridge between AI models and Scrappey's web automation platform, allowing you to:
- Create and manage browser sessions
- Send HTTP requests through Scrappey's infrastructure
- Execute browser actions (clicking, typing, scrolling, etc.)
- Handle various anti-bot protections automatically

## Setup

1. Get your Scrappey API key from [Scrappey.com](https://scrappey.com)
2. Set up your environment variable:
```bash
SCRAPPEY_API_KEY=your_api_key_here
```

## Available Tools

### 1. Create Session (`scrappey_create_session`)
Creates a new browser session that persists cookies and other state.

```json
{
  "proxy": "http://user:pass@ip:port"  // Optional: Custom proxy, leave empty for default
}
```

### 2. Destroy Session (`scrappey_destroy_session`)
Properly closes a browser session.

```json
{
  "session": "session_id_here"  // Required: The session ID to destroy
}
```

### 3. Send Request (`scrappey_request`)
Send HTTP requests through the Scrappey infrastructure.

```json
{
  "cmd": "request.get",  // Required: request.get, request.post, etc.
  "url": "https://example.com",  // Required: Target URL
  "session": "session_id_here",  // Required: Session ID to use
  "postData": "key=value",  // Optional: POST data
  "customHeaders": {  // Optional: Custom headers
    "User-Agent": "custom-agent"
  }
}
```

### 4. Browser Actions (`scrappey_browser_action`)
Execute browser automation actions.

```json
{
  "session": "session_id_here",  // Required: Session ID to use
  "browserActions": [  // Required: Array of actions to perform
    {
      "type": "click",  // Action type: click, hover, type, scroll, wait
      "cssSelector": ".button",  // CSS selector for element
      "text": "Hello",  // Text to type (for type action)
      "wait": 1000  // Wait time in ms
    }
  ]
}
```

## Typical Workflow

1. Create a session:
```json
{
  "name": "scrappey_create_session"
}
```

2. Use the returned session ID for subsequent requests:
```json
{
  "name": "scrappey_request",
  "cmd": "request.get",
  "url": "https://example.com",
  "session": "returned_session_id"
}
```

3. Perform browser actions if needed:
```json
{
  "name": "scrappey_browser_action",
  "session": "returned_session_id",
  "browserActions": [
    {
      "type": "click",
      "cssSelector": "#login-button"
    },
    {
      "type": "type",
      "cssSelector": "#username",
      "text": "myuser"
    }
  ]
}
```

4. Clean up by destroying the session when done:
```json
{
  "name": "scrappey_destroy_session",
  "session": "returned_session_id"
}
```

## Features

- Session persistence for maintaining state
- Automatic anti-bot protection handling
- Support for custom proxies
- Browser automation capabilities
- HTTP request methods (GET, POST, PUT, DELETE, PATCH)
- Custom headers and cookies support

## Best Practices

1. Always destroy sessions when you're done with them
2. Reuse sessions when making multiple requests to the same site
3. Use appropriate wait times between actions for more human-like behavior
4. Check if a session exists before using it

## Error Handling

The server will return error messages with details when something goes wrong. Common errors include:
- Invalid session IDs
- Network timeouts
- Invalid selectors for browser actions
- Anti-bot protection failures

## Resources

- [Try it on Smithery](https://smithery.ai/server/@pim97/mcp-server-scrappey)
- [Scrappey Documentation](https://wiki.scrappey.com/getting-started)
- [Get Scrappey API Key](https://scrappey.com)

## License

MIT License
