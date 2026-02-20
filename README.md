# Day4 monorepo

Web first (React + TypeScript + Vite), then mobile (React Native + TypeScript + Expo).

## Folder structure

```text
apps/
  web/          # React + TS + Vite
  api/          # Express + Supabase API
  mcp/          # MCP bridge for ChatGPT/tools
  mobile/       # Expo app (to be initialized)
packages/
  shared/       # shared types/utils/constants
docs/
  chatbot-integration.md
  mcp-chatgpt.md
```

## Run web app

```bash
npm run dev:web
```

## Run API server

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Fill these values:

```text
GOOGLE_CLIENT_ID=
JWT_SECRET=
API_PORT=8787
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

3. Run:

```bash
npm run dev:api
```

API default address:

```text
http://<server-ip>:8787/api
```

## Supabase setup

In Supabase SQL Editor, run `apps/api/supabase/schema.sql`.

## External chatbot input

External chatbot calls must go through your API server.

- API key status: `GET /api/chatbot/api-key` (user JWT)
- API key issue: `POST /api/chatbot/api-key/issue` (user JWT)
- API key revoke: `DELETE /api/chatbot/api-key` (user JWT)
- Goal list: `GET /api/chatbot/goals` (chatbot API key)
- Status write: `POST /api/chatbot/records` (chatbot API key)
- Bulk status write: `POST /api/chatbot/records/batch` (chatbot API key)

See full manual: `docs/chatbot-integration.md`

## Run MCP server

1. Copy `apps/mcp/.env.example` to `apps/mcp/.env`
2. Fill these values:

```text
DAY4_API_BASE=http://223.130.147.188:8787/api/chatbot
DAY4_MCP_TIMEOUT_MS=10000
MCP_HOST=0.0.0.0
MCP_PORT=8788
MCP_PATH=/mcp
```

3. Run stdio mode:

```bash
npm run start:mcp
```

4. Run HTTP mode (URL-based MCP clients):

```bash
npm run start:mcp:http
```

MCP Server URL example:

```text
http://223.130.147.188:8788/mcp
```

ChatGPT MCP setup guide: `docs/mcp-chatgpt.md`

MCP tools are stateless. Pass `apiKey` in each tool call.

## Web app API base

Web app default API base is:

```text
http://<current-hostname>:8787/api
```

If needed, override with env var in `apps/web/.env`:

```text
VITE_API_BASE_URL=http://<server-ip>:8787/api
```

## Build web app

```bash
npm run build:web
```

## Initialize mobile app later

```bash
npm create expo@latest apps/mobile -- --template
```

Then install workspace dependencies again:

```bash
npm install
```



