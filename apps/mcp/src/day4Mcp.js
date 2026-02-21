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
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { message: text || null }
    }

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

function validateApiKeyOrReturn(apiKey) {
  if (!validateChatbotApiKey(apiKey)) {
    return toTextResult({ ok: false, error: 'Invalid key format. Expected key starting with day4_ck_.' })
  }
  return null
}

export function createDay4McpServer() {
  const server = new McpServer({
    name: 'day4-mcp',
    version: '0.6.0',
  })

  server.tool(
    'list_goals',
    'List current user goals. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
    },
    async ({ apiKey }) => {
      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
        const goals = await requestDay4('/goals', apiKey, { method: 'GET' })
        return toTextResult({ ok: true, count: Array.isArray(goals) ? goals.length : 0, goals })
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  server.tool(
    'list_goal_records',
    'List records for a goal. apiKey(day4_ck_...) and goalId or goalName are required.',
    {
      apiKey: z.string().min(12),
      goalId: z.number().int().positive().optional(),
      goalName: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ apiKey, goalId, goalName, limit }) => {
      if (!goalId && !goalName) {
        return toTextResult({ ok: false, error: 'Either goalId or goalName is required.' })
      }

      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
        const query = new URLSearchParams()
        if (goalId) query.set('goalId', String(goalId))
        if (goalName) query.set('goalName', goalName)
        if (limit) query.set('limit', String(limit))

        const result = await requestDay4(`/records?${query.toString()}`, apiKey, { method: 'GET' })
        return toTextResult(result)
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

      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
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

  server.tool(
    'update_goal_record',
    'Update one record by recordId. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
      recordId: z.number().int().positive(),
      goalId: z.number().int().positive().optional(),
      goalName: z.string().trim().min(1).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
      level: z.number(),
      message: z.string().trim().max(500).optional(),
    },
    async ({ apiKey, recordId, goalId, goalName, date, level, message }) => {
      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
        const result = await requestDay4(`/records/${recordId}`, apiKey, {
          method: 'PUT',
          body: JSON.stringify({ goalId, goalName, date, level, message }),
        })
        return toTextResult(result)
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  server.tool(
    'delete_goal_record',
    'Delete one record by recordId. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
      recordId: z.number().int().positive(),
      goalId: z.number().int().positive().optional(),
      goalName: z.string().trim().min(1).optional(),
    },
    async ({ apiKey, recordId, goalId, goalName }) => {
      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
        const result = await requestDay4(`/records/${recordId}`, apiKey, {
          method: 'DELETE',
          body: JSON.stringify({ goalId, goalName }),
        })
        return toTextResult(result)
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  server.tool(
    'add_goal_records_batch',
    'Add multiple status records in one call. apiKey(day4_ck_...) is required.',
    {
      apiKey: z.string().min(12),
      records: z.array(
        z
          .object({
            goalId: z.number().int().positive().optional(),
            goalName: z.string().trim().min(1).optional(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
            level: z.number(),
            message: z.string().trim().max(500).optional(),
          })
          .refine((value) => Boolean(value.goalId || value.goalName), {
            message: 'Either goalId or goalName is required.',
          }),
      )
        .min(1)
        .max(50),
    },
    async ({ apiKey, records }) => {
      const invalid = validateApiKeyOrReturn(apiKey)
      if (invalid) {
        return invalid
      }

      try {
        const result = await requestDay4('/records/batch', apiKey, {
          method: 'POST',
          body: JSON.stringify({ records }),
        })

        return toTextResult(result)
      } catch (error) {
        return toTextResult({ ok: false, error: String(error?.message || error) })
      }
    },
  )

  return server
}
