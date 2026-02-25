import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createDay4McpServer } from './day4Mcp.js'

const host = process.env.MCP_HOST || '0.0.0.0'
const port = Number(process.env.PORT || process.env.MCP_PORT || 8788)
const path = process.env.MCP_PATH || '/mcp'

const sessionTtlMs = Number(process.env.MCP_SESSION_TTL_MS || 30 * 60 * 1000)
const sessionSweepMs = Number(process.env.MCP_SESSION_SWEEP_MS || 60 * 1000)
const maxSessions = Number(process.env.MCP_MAX_SESSIONS || 200)

const app = createMcpExpressApp({ host })

const sessions = new Map()

function nowMs() {
  return Date.now()
}

function touchSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return
  session.lastTouchedAt = nowMs()
}

function registerSession(sessionId, transport) {
  sessions.set(sessionId, {
    transport,
    createdAt: nowMs(),
    lastTouchedAt: nowMs(),
  })
}

function getSessionTransport(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return null
  touchSession(sessionId)
  return session.transport
}

async function closeSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return

  sessions.delete(sessionId)
  try {
    await session.transport.close()
  } catch {
    // Ignore close errors during cleanup
  }
}

async function evictOldestSessionsIfNeeded() {
  if (sessions.size < maxSessions) {
    return
  }

  const ordered = [...sessions.entries()].sort((a, b) => a[1].lastTouchedAt - b[1].lastTouchedAt)
  const overflowCount = sessions.size - maxSessions + 1

  for (let index = 0; index < overflowCount; index += 1) {
    const entry = ordered[index]
    if (!entry) break
    await closeSession(entry[0])
  }
}

async function cleanupStaleSessions() {
  const cutoff = nowMs() - sessionTtlMs
  const staleSessionIds = [...sessions.entries()]
    .filter(([, session]) => session.lastTouchedAt < cutoff)
    .map(([sessionId]) => sessionId)

  for (const sessionId of staleSessionIds) {
    await closeSession(sessionId)
  }
}

const sweepTimer = setInterval(() => {
  void cleanupStaleSessions()
}, sessionSweepMs)

sweepTimer.unref?.()

app.post(path, async (req, res) => {
  const sessionIdHeader = req.headers['mcp-session-id']
  const sessionId = sessionIdHeader ? String(sessionIdHeader) : null
  let transport = sessionId ? getSessionTransport(sessionId) : null

  try {
    if (!transport) {
      await evictOldestSessionsIfNeeded()

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          if (transport) {
            registerSession(id, transport)
          }
        },
      })

      transport.onclose = () => {
        if (transport?.sessionId) {
          sessions.delete(transport.sessionId)
        }
      }

      const server = createDay4McpServer()
      await server.connect(transport)
    }

    await transport.handleRequest(req, res, req.body)
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
})

app.get(path, async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  if (!sessionId) {
    res.status(400).send('Missing MCP session id')
    return
  }

  const transport = getSessionTransport(String(sessionId))
  if (!transport) {
    res.status(404).send('Session not found')
    return
  }

  await transport.handleRequest(req, res)
})

app.delete(path, async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  if (!sessionId) {
    res.status(400).send('Missing MCP session id')
    return
  }

  const transport = getSessionTransport(String(sessionId))
  if (!transport) {
    res.status(404).send('Session not found')
    return
  }

  await transport.handleRequest(req, res)
})

app.listen(port, host, () => {
  console.log(`Day4 MCP HTTP server listening on ${host}:${port}${path}`)
  console.log(`Session policy: ttl=${sessionTtlMs}ms sweep=${sessionSweepMs}ms max=${maxSessions}`)
})
