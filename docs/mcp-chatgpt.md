# Day4 MCP Server (ChatGPT Tool Bridge)

This MCP server lets ChatGPT call Day4 chatbot endpoints.

It supports multi-user usage by storing each user's chatbot key in that MCP session.

## Tools

- `set_chatbot_api_key`: save current user's Day4 chatbot API key in this MCP session
- `chatbot_api_key_status`: check key status for this session
- `clear_chatbot_api_key`: remove key from this session
- `list_goals`: list goals for the current session key
- `add_goal_record`: add a status record for the current session key

`list_goals` and `add_goal_record` also accept optional `apiKey` input for one-off calls.

## Environment

Create `apps/mcp/.env` from `apps/mcp/.env.example`.

```text
DAY4_API_BASE=http://223.130.147.188:8787/api/chatbot
DAY4_MCP_TIMEOUT_MS=10000
MCP_HOST=0.0.0.0
MCP_PORT=8788
MCP_PATH=/mcp
```

## Run

Stdio mode (local MCP clients):

```bash
npm run start:mcp
```

HTTP mode (URL-based MCP clients like ChatGPT MCP URL input):

```bash
npm --workspace apps/mcp run start:http
```

## MCP server URL

If this machine public IP is `223.130.147.188` and `MCP_PORT=8788`, set MCP Server URL to:

```text
http://223.130.147.188:8788/mcp
```

If using local only:

```text
http://localhost:8788/mcp
```

## ChatGPT usage flow

1. Call `set_chatbot_api_key` with your own `day4_ck_...` key.
2. Call `list_goals`.
3. Call `add_goal_record`.
4. Optionally call `clear_chatbot_api_key` when done.

For ChatGPT remote MCP, use HTTPS domain URL (not plain HTTP IP) when required by platform policy.
