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

1. In Supabase SQL Editor, run `apps/api/supabase/schema.sql`
2. Migrate existing local SQLite data (optional):

```bash
npm --workspace apps/api run migrate:supabase
```

## External chatbot input

External clients should call your API (not Supabase directly).

Example endpoint:

```text
POST /api/goals/:goalId/records
Authorization: Bearer <your-app-jwt>
```

Payload:

```json
{
  "date": "2026-02-20",
  "level": 72.5,
  "message": "?? ?? ??"
}
```

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
