import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { clearDay4McpSession, createDay4McpServer } from './day4Mcp.js'

const host = process.env.MCP_HOST || '0.0.0.0'
const port = Number(process.env.PORT || process.env.MCP_PORT || 8788)
const path = process.env.MCP_PATH || '/mcp'

const app = createMcpExpressApp({ host })
const transports = new Map()

app.post(path, async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  let transport = sessionId ? transports.get(String(sessionId)) : undefined

  try {
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => transports.set(id, transport),
      })

      transport.onclose = () => {
        if (transport?.sessionId) {
          clearDay4McpSession(transport.sessionId)
          transports.delete(transport.sessionId)
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

  const transport = transports.get(String(sessionId))
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

  const transport = transports.get(String(sessionId))
  if (!transport) {
    res.status(404).send('Session not found')
    return
  }

  await transport.handleRequest(req, res)
})

app.listen(port, host, () => {
  console.log(`Day4 MCP HTTP server listening at http://${host}:${port}${path}`)
})

