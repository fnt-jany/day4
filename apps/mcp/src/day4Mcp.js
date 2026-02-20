import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const rawBase = process.env.DAY4_API_BASE || ''
const timeoutMs = Number(process.env.DAY4_MCP_TIMEOUT_MS || 10000)

if (!rawBase) {
  throw new Error('DAY4_API_BASE is required')
}

const apiBase = rawBase.replace(/\/+$/, '')

function validateChatbotApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith('day4_ck_')
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

export function createDay4McpServer() {
  const server = new McpServer({
    name: 'day4-mcp',
    version: '0.4.0',
  })

  server.tool(
    'list_goals',
    'List current user goals. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
    },
    async ({ apiKey }) => {
      try {
        if (!validateChatbotApiKey(apiKey)) {
          return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
        }

        const goals = await requestDay4('/goals', apiKey, { method: 'GET' })
        return toTextResult({ ok: true, count: Array.isArray(goals) ? goals.length : 0, goals })
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  server.tool(
    'add_goal_record',
    'Add a status record to a goal. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
      goalId: z.number().int().positive().optional(),
      goalName: z.string().trim().min(1).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
      level: z.number(),
      message: z.string().trim().max(500).optional(),
    },
    async ({ apiKey, goalId, goalName, date, level, message }) => {
      if (!goalId && !goalName) {
        return toTextResult({ ok: false, error: 'Either goalId or goalName is required.' })
      }

      try {
        if (!validateChatbotApiKey(apiKey)) {
          return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
        }

        const created = await requestDay4('/records', apiKey, {
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
