# Setting Up Scrappey MCP in Cursor

## Quick Setup Guide

### Step 1: Build the MCP Server

```bash
cd path
npm install
npm run build
```

### Step 2: Configure Cursor

#### Method A: Using Cursor Settings UI

1. Open Cursor
2. Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings
3. Search for "MCP" in the settings search bar
4. Look for "MCP Servers" or "Model Context Protocol" section
5. Click "Add Server" or the `+` button
6. Fill in:
   - **Server Name**: `scrappey`
   - **Command**: `node`
   - **Arguments**: `path`
   - **Environment Variables**: 
     - Key: `SCRAPPEY_API_KEY`
     - Value: `your_actual_api_key_here`

#### Method B: Using Settings JSON

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `Preferences: Open User Settings (JSON)`
3. Add this configuration:

```json
{
  "mcp.servers": {
    "scrappey": {
      "command": "node",
      "args": ["path"],
      "env": {
        "SCRAPPEY_API_KEY": "your_scrappey_api_key_here"
      }
    }
  }
}
```

**Important**: Replace `your_scrappey_api_key_here` with your actual Scrappey API key from [scrappey.com](https://scrappey.com)

### Step 3: Restart Cursor

Close and reopen Cursor to load the MCP server.

### Step 4: Verify It's Working

1. Open the AI chat in Cursor
2. Try asking: "Can you help me create a Scrappey session?"
3. The AI should be able to use the Scrappey tools

## Available Tools in Cursor

Once configured, you can use these tools through the AI:

- **scrappey_create_session** - Create a browser session
- **scrappey_destroy_session** - Close a session
- **scrappey_list_sessions** - List active sessions
- **scrappey_session_active** - Check if session is active
- **scrappey_request** - Send HTTP requests
- **scrappey_browser_action** - Execute browser automation
- **scrappey_screenshot** - Capture screenshots

## Troubleshooting

### MCP Server Not Loading

1. Check that the path to `dist/scrappey-mcp.js` is correct
2. Verify Node.js is installed: `node --version`
3. Check Cursor's output/logs for errors
4. Ensure the build completed successfully: `npm run build`

### Tools Not Available

1. Restart Cursor completely
2. Check that the MCP server configuration is correct in settings
3. Verify your API key is set correctly
4. Check Cursor's developer console for errors (Help > Toggle Developer Tools)

### Path Issues (Windows)

If you're on Windows, use double backslashes or forward slashes:
- ✅ `C:\\Users\\...\\dist\\scrappey-mcp.js`
- ✅ `C:/Users/.../dist/scrappey-mcp.js`
- ❌ `C:\Users\...\dist\scrappey-mcp.js` (single backslashes may cause issues)

## Example Usage in Cursor

Once set up, you can ask the AI in Cursor:

- "Create a Scrappey session and navigate to example.com"
- "Take a screenshot of google.com"
- "Scrape the product list from example.com/products"
- "Automate a login flow on example.com"

The AI will automatically use the appropriate Scrappey tools!

