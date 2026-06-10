# Scrappey MCP Server

A Model Context Protocol (MCP) server for interacting with Scrappey.com's browser-backed web automation and data-extraction capabilities. Try it out directly at [smithery.ai/server/@pim97/mcp-server-scrappey](https://smithery.ai/server/@pim97/mcp-server-scrappey).

## Overview

This MCP server provides a bridge between AI models and Scrappey's web automation platform, allowing you to:
- Create and manage browser sessions
- Send HTTP requests through Scrappey's browser-backed infrastructure
- Execute browser actions (clicking, typing, scrolling, etc.)
- Render pages that rely on JavaScript challenge pages from common bot-management systems (Cloudflare, Datadome, Kasada, etc.)
- Complete interactive challenge widgets when a page requires them (Turnstile, reCAPTCHA, hCaptcha, etc.)
- Take screenshots and record videos
- Intercept network requests

This server is intended for legitimate development use — application and integration testing, monitoring your own services, and collecting data you are authorized to access. See [Responsible Use](#responsible-use).

## Setup

### Installation

```bash
npm install
npm run build
```

### Configuration

1. Get your Scrappey API key from [Scrappey.com](https://scrappey.com)
2. Set up your environment variable:
```bash
SCRAPPEY_API_KEY=your_api_key_here
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scrappey": {
      "command": "node",
      "args": ["path/to/dist/scrappey-mcp.js"],
      "env": {
        "SCRAPPEY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Cursor IDE Configuration

Cursor supports MCP servers through its settings. Configure it in one of these ways:

**Option 1: Via Cursor Settings UI**
1. Open Cursor Settings (Ctrl+, or Cmd+,)
2. Search for "MCP" or "Model Context Protocol"
3. Add a new MCP server with:
   - **Name**: `scrappey`
   - **Command**: `node`
   - **Args**: `["C:\\Users\\pim_d\\Desktop\\scrappey.com\\mcp-smith\\mcp-server-scrappey\\dist\\scrappey-mcp.js"]`
   - **Environment Variables**: Add `SCRAPPEY_API_KEY` with your API key

**Option 2: Via Settings JSON**
1. Open Cursor Settings (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "Preferences: Open User Settings (JSON)"
3. Add the MCP server configuration:

```json
{
  "mcp.servers": {
    "scrappey": {
      "command": "node",
      "args": ["C:\\Users\\pim_d\\Desktop\\scrappey.com\\mcp-smith\\mcp-server-scrappey\\dist\\scrappey-mcp.js"],
      "env": {
        "SCRAPPEY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Note**: Adjust the path to `dist/scrappey-mcp.js` based on where you installed the MCP server.

After configuration, restart Cursor to load the MCP server. You should see Scrappey tools available in the AI chat interface.

## Available Tools

### 1. Create Session (`scrappey_create_session`)
Creates a new browser session that persists cookies and other state.

```json
{
  "proxy": "http://user:pass@ip:port",
  "proxyCountry": "UnitedStates",
  "premiumProxy": true,
  "mobileProxy": false,
  "browser": [{"name": "firefox", "minVersion": 120, "maxVersion": 130}],
  "userAgent": "custom-user-agent"
}
```

### 2. Destroy Session (`scrappey_destroy_session`)
Properly closes a browser session to free resources.

```json
{
  "session": "session_id_here"
}
```

### 3. List Sessions (`scrappey_list_sessions`)
List all active sessions for the current user.

```json
{}
```

**Response:**
```json
{
  "sessions": [{"session": "abc123", "lastAccessed": 1234567890}],
  "open": 1,
  "limit": 100
}
```

### 4. Check Session Active (`scrappey_session_active`)
Check if a specific session is currently active.

```json
{
  "session": "session_id_here"
}
```

### 5. Send Request (`scrappey_request`)
Send browser-backed HTTP requests, with automatic handling of JavaScript challenge pages.

```json
{
  "cmd": "request.get",
  "url": "https://example.com",
  "session": "session_id_here",
  "postData": {"key": "value"},
  "customHeaders": {"User-Agent": "custom-agent"},
  "cookies": "session=abc123",
  "proxyCountry": "Germany",
  "premiumProxy": true,
  "cloudflareBypass": true,
  "datadomeBypass": true,
  "automaticallySolveCaptchas": true,
  "alwaysLoad": ["recaptcha", "hcaptcha"],
  "screenshot": true,
  "cssSelector": ".product-title",
  "innerText": true,
  "includeLinks": true,
  "includeImages": true,
  "interceptFetchRequest": "https://api.example.com/data",
  "abortOnDetection": ["analytics.com", "tracking.js"],
  "whitelistedDomains": ["example.com"],
  "blockCookieBanners": true
}
```

### 6. Browser Actions (`scrappey_browser_action`)
Execute browser automation actions.

```json
{
  "session": "session_id_here",
  "url": "https://example.com",
  "cmd": "request.get",
  "browserActions": [
    {"type": "wait_for_selector", "cssSelector": "#login-form"},
    {"type": "type", "cssSelector": "#username", "text": "myuser"},
    {"type": "type", "cssSelector": "#password", "text": "mypassword"},
    {"type": "solve_captcha", "captcha": "turnstile"},
    {"type": "click", "cssSelector": "#submit", "waitForSelector": ".dashboard"},
    {"type": "execute_js", "code": "document.querySelector('.user-data').innerText"}
  ],
  "mouseMovements": true
}
```

#### Supported Browser Action Types:

| Action | Description |
|--------|-------------|
| `click` | Click on an element |
| `type` | Type text into an input field |
| `goto` | Navigate to a URL |
| `wait` | Wait for specified milliseconds |
| `wait_for_selector` | Wait for an element to appear |
| `wait_for_function` | Wait for JavaScript condition to be true |
| `wait_for_load_state` | Wait for page load state (domcontentloaded, networkidle, load) |
| `wait_for_cookie` | Wait for a cookie to be set |
| `execute_js` | Execute JavaScript code |
| `scroll` | Scroll to element or page bottom |
| `hover` | Hover over an element |
| `keyboard` | Press keyboard keys (enter, tab, etc.) |
| `dropdown` | Select option from dropdown |
| `switch_iframe` | Switch to an iframe |
| `set_viewport` | Change browser viewport size |
| `if` | Conditional action execution |
| `while` | Loop actions while condition is true |
| `solve_captcha` | Solve various captcha types |
| `remove_iframes` | Remove all iframes from page |

#### Supported Interactive Challenge Types:

- `turnstile` - Cloudflare Turnstile
- `recaptcha` / `recaptchav2` / `recaptchav3` - Google reCAPTCHA
- `hcaptcha` / `hcaptcha_inside` / `hcaptcha_enterprise_inside` - hCaptcha
- `funcaptcha` - FunCaptcha/Arkose Labs
- `perimeterx` - PerimeterX
- `mtcaptcha` - MTCaptcha
- `custom` - Custom image captcha

### 7. Screenshot (`scrappey_screenshot`)
Take a screenshot of a webpage.

```json
{
  "url": "https://example.com",
  "session": "optional_session_id",
  "screenshotWidth": 1920,
  "screenshotHeight": 1080,
  "fullPage": true,
  "browserActions": [
    {"type": "wait", "wait": 2000}
  ],
  "premiumProxy": true
}
```

## Challenge-Page Handling

Many sites serve JavaScript challenge pages before returning content. Scrappey renders these in a real browser so your automated requests receive the final page. The server is compatible with challenge pages from common bot-management systems:

- **Cloudflare** - Bot Management, Turnstile, Challenge pages
- **Datadome**
- **PerimeterX**
- **Kasada**
- **Akamai** - Bot Manager
- **Incapsula** - Imperva

Enable handling for a specific system per request:
```json
{
  "cloudflareBypass": true,
  "datadomeBypass": true,
  "kasadaBypass": true
}
```

> The option keys above (`cloudflareBypass`, etc.) are Scrappey API field names and are kept as-is for compatibility.

## Proxy Options

```json
{
  "proxy": "http://user:pass@ip:port",
  "proxyCountry": "UnitedStates",
  "premiumProxy": true,
  "mobileProxy": true,
  "noProxy": false
}
```

**Supported Countries:** UnitedStates, UnitedKingdom, Germany, France, and many more.

## Error Codes

The server provides detailed error information:

| Code | Description |
|------|-------------|
| CODE-0001 | Server capacity full, try again |
| CODE-0002 | Cloudflare blocked |
| CODE-0007 | Turnstile/Proxy error |
| CODE-0010 | Datadome proxy blocked |
| CODE-0024 | Proxy timeout |
| CODE-0029 | Too many sessions open |
| CODE-0032 | Turnstile captcha failed |

## Typical Workflow

1. **Create a session:**
```json
{"name": "scrappey_create_session"}
```

2. **Navigate and interact:**
```json
{
  "name": "scrappey_browser_action",
  "session": "returned_session_id",
  "url": "https://example.com/login",
  "cmd": "request.get",
  "browserActions": [
    {"type": "type", "cssSelector": "#username", "text": "myuser"},
    {"type": "type", "cssSelector": "#password", "text": "mypass"},
    {"type": "click", "cssSelector": "#login-btn", "waitForSelector": ".dashboard"}
  ]
}
```

3. **Extract data:**
```json
{
  "name": "scrappey_request",
  "cmd": "request.get",
  "url": "https://example.com/data",
  "session": "returned_session_id",
  "cssSelector": ".product-list"
}
```

4. **Clean up:**
```json
{
  "name": "scrappey_destroy_session",
  "session": "returned_session_id"
}
```

## Best Practices

1. **Reuse sessions** for related requests to maintain state
2. **Destroy sessions** when done to free resources
3. **Use premium proxies** for more reliable connections
4. **Enable automatic challenge handling** for sites that serve challenge pages
5. **Use appropriate wait times** between actions so pages have time to load
6. **Monitor session limits** to avoid hitting limits

## Responsible Use

This server is a development tool for browser-based automation and data extraction. Use it only for lawful, authorized purposes, such as:

- Testing and monitoring applications and integrations you own or operate
- Collecting data you are permitted to access

When accessing third-party sites, follow each site's terms of service, robots directives, and rate limits, respect personal data and copyright, and comply with all applicable laws. You are responsible for how you use this server and your Scrappey account.

## Deployment

### Smithery Deployment

```bash
# Build
npm run build

# Deploy via Smithery CLI
npx @anthropic/smithery-cli deploy
```

### Docker

```bash
docker build -t scrappey-mcp .
docker run -e SCRAPPEY_API_KEY=your_key scrappey-mcp
```

## Resources

- [Try on Smithery](https://smithery.ai/server/@pim97/mcp-server-scrappey)
- [Scrappey Documentation](https://wiki.scrappey.com/getting-started)
- [Get Scrappey API Key](https://scrappey.com)

## License

MIT License
