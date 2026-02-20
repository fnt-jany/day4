# Day4 MCP Server (ChatGPT Tool Bridge)

This MCP server lets ChatGPT call Day4 chatbot endpoints.

The server is stateless for user auth: each tool call must include `apiKey` (`day4_ck_...`).

## Tools

- `list_goals`: list goals for the provided `apiKey`
- `add_goal_record`: add a status record for the provided `apiKey`
- `add_goal_records_batch`: add multiple records in one request for the provided `apiKey`

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

1. Call `list_goals` with `{ "apiKey": "day4_ck_..." }`.
2. Call `add_goal_record` with `apiKey` included in input.
3. For bulk insert, call `add_goal_records_batch` with `{ apiKey, records: [...] }`.

For ChatGPT remote MCP, use HTTPS domain URL (not plain HTTP IP) when required by platform policy.

