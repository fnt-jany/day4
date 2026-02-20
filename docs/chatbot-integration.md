# Chatbot Integration Manual

This manual describes how an external chatbot can write Day4 goal status records through your API server.

## Base URL

```text
http://<your-api-host>:8787/api
```

## 1) Issue a user-scoped chatbot API key

In Day4 app settings, issue a chatbot API key for that user.

- API used by app: `POST /api/chatbot/api-key/issue`
- The full key is shown only once.

Example key format:

```text
day4_ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 2) List goals (chatbot selects target)

Request:

```http
GET /api/chatbot/goals
Authorization: Bearer <chatbot_api_key>
```

## 3) Create status record from chatbot

You can send either `goalId` or `goalName`.

Request:

```http
POST /api/chatbot/records
Authorization: Bearer <chatbot_api_key>
Content-Type: application/json
```

Body (recommended):

```json
{
  "goalId": 12,
  "date": "2026-02-20",
  "level": 42.5,
  "message": "today progress"
}
```

Response:

```json
{
  "ok": true,
  "goalId": 12,
  "goalName": "Running",
  "recordId": 99
}
```

## Error meanings

- `401 chatbot unauthorized`: key missing/invalid/revoked
- `404 goal not found`: goal does not exist or does not belong to the user
- `409 goal name is ambiguous. use goalId.`: more than one goal has same name
- `400 invalid payload`: missing `date`, `level`, or both `goalId` and `goalName`

## Recommended chatbot behavior

1. Call `GET /api/chatbot/goals` first.
2. Ask user to pick one goal when multiple options exist.
3. Use `goalId` for writes.
4. Send `date` in `YYYY-MM-DD` format.
5. Send `level` as number.

## Security notes

- Keep `chatbot_api_key` secret.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to chatbot or browser.
- Revoke and re-issue key if leaked.
