# Day4 MCP Server (ChatGPT Tool Bridge)

This MCP server lets ChatGPT call Day4 chatbot endpoints.

The server is stateless for user auth: each tool call must include `apiKey` (`day4_ck_...`).

## Tools

- `list_goals`: list goals for the provided `apiKey`
- `list_goal_records`: list records for one goal (`goalId` or `goalName`)
- `add_goal_record`: add a status record for the provided `apiKey`
- `update_goal_record`: update one record by `recordId`
- `delete_goal_record`: delete one record by `recordId`
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

## MCP server URL (current)

```text
https://day4-mcp.onrender.com/mcp
```

## ChatGPT Web setup (Developer Mode)

1. In ChatGPT Web, click your profile (top-right).
2. Go to Settings -> Apps -> Advanced settings -> Developer mode -> Build app.
3. In the app builder, open MCP settings and add an MCP server.
4. Enter MCP server URL:

```text
https://day4-mcp.onrender.com/mcp
```

5. Authentication method: select `Unrestricted (None)`.
6. Save and reconnect if needed.
7. Confirm tools are visible:
- `list_goals`
- `list_goal_records`
- `add_goal_record`
- `update_goal_record`
- `delete_goal_record`
- `add_goal_records_batch`

## Setup reference image

![ChatGPT MCP setup flow](../apps/web/src/assets/mcp-chatgpt-setup.svg)

## API key issue

Issue your user API key (`day4_ck_...`) in Day4 app:

- Profile -> Settings -> Chatbot API Key

Then use that key in MCP tool inputs.

## First test calls in ChatGPT

1. `list_goals` with:

```json
{ "apiKey": "day4_ck_xxx" }
```

2. `add_goal_record` with:

```json
{
  "apiKey": "day4_ck_xxx",
  "goalId": 12,
  "date": "2026-02-20",
  "level": 72.5,
  "message": "today progress"
}
```

3. `list_goal_records` with:

```json
{
  "apiKey": "day4_ck_xxx",
  "goalId": 12,
  "limit": 20
}
```

4. `update_goal_record` with:

```json
{
  "apiKey": "day4_ck_xxx",
  "recordId": 345,
  "date": "2026-02-21",
  "level": 73.1,
  "message": "edited"
}
```

5. `delete_goal_record` with:

```json
{
  "apiKey": "day4_ck_xxx",
  "recordId": 345
}
```

6. `add_goal_records_batch` with:

```json
{
  "apiKey": "day4_ck_xxx",
  "records": [
    {
      "goalId": 12,
      "date": "2026-02-20",
      "level": 72.5,
      "message": "today progress"
    },
    {
      "goalId": 12,
      "date": "2026-02-21",
      "level": 73,
      "message": "next day"
    }
  ]
}
```

For remote ChatGPT MCP, keep URL as HTTPS domain (not HTTP IP).
