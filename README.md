# NDResolution monorepo

Web first (React + TypeScript + Vite), then mobile (React Native + TypeScript + Expo).

## Folder structure

```text
apps/
  web/          # React + TS + Vite
  api/          # Express + SQLite API
  mobile/       # Expo app (to be initialized)
packages/
  shared/       # shared types/utils/constants
```

## Run web app

```bash
npm run dev:web
```

## Run API server

```bash
npm run dev:api
```

API default address:

```text
http://<server-ip>:8787/api
```

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