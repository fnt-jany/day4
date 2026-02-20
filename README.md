# Day4 monorepo

Web first (React + TypeScript + Vite), then mobile (React Native + TypeScript + Expo).

## Folder structure

```text
apps/
  web/          # React + TS + Vite
  api/          # Express + Supabase API
  mobile/       # Expo app (to be initialized)
packages/
  shared/       # shared types/utils/constants
docs/
  chatbot-integration.md
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

See full manual: `docs/chatbot-integration.md`

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
