# Scrappey MCP Server

A Model Context Protocol (MCP) server for interacting with Scrappey.com's web automation and scraping capabilities. Try it out directly at [smithery.ai/server/@pim97/mcp-server-scrappey](https://smithery.ai/server/@pim97/mcp-server-scrappey).

## Overview

This MCP server provides a bridge between AI models and Scrappey's web automation platform, allowing you to:
- Create and manage browser sessions
- Send HTTP requests through Scrappey's infrastructure
- Execute browser actions (clicking, typing, scrolling, etc.)
- Handle various anti-bot protections automatically (Cloudflare, Datadome, Kasada, etc.)
- Solve captchas automatically (Turnstile, reCAPTCHA, hCaptcha, etc.)
- Take screenshots and record videos
- Intercept network requests

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
Send HTTP requests with antibot bypass capabilities.

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

#### Supported Captcha Types:

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

## Antibot Bypass

The server automatically handles various protection systems:

- **Cloudflare** - Bot Management, Turnstile, Challenge pages
- **Datadome** - Advanced bot detection
- **PerimeterX** - Behavioral analysis
- **Kasada** - Fingerprinting and challenges
- **Akamai** - Bot Manager
- **Incapsula** - Imperva security

Enable specific bypasses:
```json
{
  "cloudflareBypass": true,
  "datadomeBypass": true,
  "kasadaBypass": true
}
```

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
3. **Use premium proxies** for better success rates on protected sites
4. **Enable automatic captcha solving** for sites with challenges
5. **Use appropriate wait times** between actions for human-like behavior
6. **Monitor session limits** to avoid hitting limits

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
