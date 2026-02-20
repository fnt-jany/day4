import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const rawBase = process.env.DAY4_API_BASE || ''
const timeoutMs = Number(process.env.DAY4_MCP_TIMEOUT_MS || 10000)

if (!rawBase) {
  throw new Error('DAY4_API_BASE is required')
}

const apiBase = rawBase.replace(/\/+$/, '')
const sessionChatbotApiKeys = new Map()

function normalizeSessionId(sessionId) {
  return sessionId || 'default'
}

function validateChatbotApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith('day4_ck_')
}

function resolveChatbotApiKey({ explicitApiKey, sessionId }) {
  if (explicitApiKey) {
    return explicitApiKey
  }

  const scopedSessionId = normalizeSessionId(sessionId)
  return sessionChatbotApiKeys.get(scopedSessionId) ?? null
}

async function requestDay4(path, apiKey, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      const errorMessage = data?.message || `HTTP ${response.status}`
      throw new Error(errorMessage)
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}

function toTextResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

function chatbotKeyHint() {
  return {
    ok: false,
    error: 'No chatbot API key is configured for this session. Call set_chatbot_api_key first, or pass apiKey in this tool input.',
  }
}

export function clearDay4McpSession(sessionId) {
  const scopedSessionId = normalizeSessionId(sessionId)
  sessionChatbotApiKeys.delete(scopedSessionId)
}

export function createDay4McpServer() {
  const server = new McpServer({
    name: 'day4-mcp',
    version: '0.3.1',
  })

  server.tool(
    'set_chatbot_api_key',
    'Set the Day4 chatbot API key for this MCP session.',
    {
      apiKey: z.string().min(12),
    },
    async ({ apiKey }, extra) => {
      if (!validateChatbotApiKey(apiKey)) {
        return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
      }

      const scopedSessionId = normalizeSessionId(extra?.sessionId)
      sessionChatbotApiKeys.set(scopedSessionId, apiKey)

      return toTextResult({
        ok: true,
        sessionId: scopedSessionId,
        keyPrefix: apiKey.slice(0, 16),
        message: 'Chatbot API key saved for this MCP session.',
      })
    },
  )

  server.tool(
    'clear_chatbot_api_key',
    'Clear the Day4 chatbot API key from this MCP session.',
    {},
    async (_, extra) => {
      const scopedSessionId = normalizeSessionId(extra?.sessionId)
      const hadKey = sessionChatbotApiKeys.delete(scopedSessionId)
      return toTextResult({ ok: true, sessionId: scopedSessionId, hadKey })
    },
  )

  server.tool(
    'chatbot_api_key_status',
    'Show whether this session has a configured key.',
    {},
    async (_, extra) => {
      const scopedSessionId = normalizeSessionId(extra?.sessionId)
      const sessionKey = sessionChatbotApiKeys.get(scopedSessionId)
      return toTextResult({
        ok: true,
        sessionId: scopedSessionId,
        hasSessionKey: Boolean(sessionKey),
        sessionKeyPrefix: sessionKey ? sessionKey.slice(0, 16) : null,
      })
    },
  )

  server.tool(
    'list_goals',
    'List current user goals from Day4 chatbot API key scope.',
    {
      apiKey: z.string().min(12).optional(),
    },
    async ({ apiKey }, extra) => {
      try {
        const resolvedApiKey = resolveChatbotApiKey({ explicitApiKey: apiKey, sessionId: extra?.sessionId })
        if (!resolvedApiKey) {
          return toTextResult(chatbotKeyHint())
        }

        if (!validateChatbotApiKey(resolvedApiKey)) {
          return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
        }

        const goals = await requestDay4('/goals', resolvedApiKey, { method: 'GET' })
        return toTextResult({ ok: true, count: Array.isArray(goals) ? goals.length : 0, goals })
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  server.tool(
    'add_goal_record',
    'Add a status record to a goal by goalId or goalName. Provide date(YYYY-MM-DD), level(number), and optional message.',
    {
      apiKey: z.string().min(12).optional(),
      goalId: z.number().int().positive().optional(),
      goalName: z.string().trim().min(1).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
      level: z.number(),
      message: z.string().trim().max(500).optional(),
    },
    async ({ apiKey, goalId, goalName, date, level, message }, extra) => {
      if (!goalId && !goalName) {
        return toTextResult({ ok: false, error: 'Either goalId or goalName is required.' })
      }

      try {
        const resolvedApiKey = resolveChatbotApiKey({ explicitApiKey: apiKey, sessionId: extra?.sessionId })
        if (!resolvedApiKey) {
          return toTextResult(chatbotKeyHint())
        }

        if (!validateChatbotApiKey(resolvedApiKey)) {
          return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
        }

        const created = await requestDay4('/records', resolvedApiKey, {
          method: 'POST',
          body: JSON.stringify({ goalId, goalName, date, level, message }),
        })

        return toTextResult({ ok: true, record: created })
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  return server
}
