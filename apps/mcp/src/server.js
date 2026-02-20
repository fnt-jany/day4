import 'dotenv/config'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createDay4McpServer } from './day4Mcp.js'

const server = createDay4McpServer()
const transport = new StdioServerTransport()
await server.connect(transport)
