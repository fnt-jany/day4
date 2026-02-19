import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, 'data.sqlite')

const app = express()
const port = Number(process.env.API_PORT || 8787)
const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret'
const googleClient = new OAuth2Client(googleClientId)

app.use(cors())
app.use(express.json())

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
})

await db.exec('PRAGMA foreign_keys = ON;')

await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`)

await db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  target_level REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`)

await db.exec(`
CREATE TABLE IF NOT EXISTS goal_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  level REAL NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
);
`)

await db.exec(`
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`)

await db.exec(`
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)

const goalColumns = await db.all(`PRAGMA table_info(goals)`)
if (!goalColumns.some((column) => column.name === 'user_id')) {
  await db.exec(`ALTER TABLE goals ADD COLUMN user_id INTEGER`)
}

await db.exec(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);`)
await db.exec(`CREATE INDEX IF NOT EXISTS idx_goal_records_goal_id ON goal_records(goal_id);`)

const mapGoal = (row) => ({
  id: row.id,
  name: row.name,
  targetDate: row.target_date,
  targetLevel: row.target_level,
  unit: row.unit,
  inputs: [],
})

const getToken = (req) => {
  const value = req.headers.authorization || ''
  if (!value.startsWith('Bearer ')) {
    return null
  }
  return value.slice(7).trim() || null
}

const requireAuth = async (req, res, next) => {
  const token = getToken(req)
  if (!token) {
    res.status(401).json({ message: 'unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    const userId = Number(payload?.userId)

    if (!userId) {
      res.status(401).json({ message: 'unauthorized' })
      return
    }

    const user = await db.get(`SELECT id, email, name, picture_url FROM users WHERE id = ?`, [userId])
    if (!user) {
      res.status(401).json({ message: 'unauthorized' })
      return
    }

    req.userId = user.id
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.picture_url ?? null,
    }

    next()
  } catch {
    res.status(401).json({ message: 'unauthorized' })
  }
}

async function listGoals(userId) {
  const goals = (
    await db.all(
      `SELECT id, name, target_date, target_level, unit
       FROM goals
       WHERE user_id = ?
       ORDER BY id DESC`,
      [userId],
    )
  ).map(mapGoal)

  if (goals.length === 0) {
    return []
  }

  const records = await db.all(
    `SELECT gr.id, gr.goal_id, gr.date, gr.level, gr.message
     FROM goal_records gr
     JOIN goals g ON g.id = gr.goal_id
     WHERE g.user_id = ?
     ORDER BY gr.date DESC, gr.id DESC`,
    [userId],
  )

  const byGoal = new Map(goals.map((goal) => [goal.id, goal]))
  for (const record of records) {
    const goal = byGoal.get(record.goal_id)
    if (!goal) continue

    goal.inputs.push({
      id: record.id,
      date: record.date,
      level: record.level,
      message: record.message ?? undefined,
    })
  }

  return goals
}

async function getChartSpacingMode(userId) {
  const row = await db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'chart_spacing_mode'`, [userId])
  const value = row?.value
  return value === 'actual' ? 'actual' : 'equal'
}

async function getLanguage(userId) {
  const row = await db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'language'`, [userId])
  const value = row?.value
  return value === 'en' ? 'en' : 'ko'
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/google', async (req, res) => {
  const credential = req.body?.credential

  if (!credential || typeof credential !== 'string') {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  if (!googleClientId) {
    res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not configured' })
    return
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    })

    const payload = ticket.getPayload()
    const googleSub = payload?.sub

    if (!googleSub) {
      res.status(401).json({ message: 'invalid token' })
      return
    }

    const email = payload.email || null
    const name = payload.name || null
    const pictureUrl = payload.picture || null

    await db.run(
      `INSERT INTO users (google_sub, email, name, picture_url, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture_url = excluded.picture_url,
         updated_at = datetime('now')`,
      [googleSub, email, name, pictureUrl],
    )

    const user = await db.get(
      `SELECT id, email, name, picture_url
       FROM users
       WHERE google_sub = ?`,
      [googleSub],
    )

    const token = jwt.sign({ userId: user.id, sub: googleSub }, jwtSecret, {
      expiresIn: '7d',
    })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.picture_url ?? null,
      },
    })
  } catch {
    res.status(401).json({ message: 'invalid token' })
  }
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user })
})

app.get('/api/settings', requireAuth, async (req, res) => {
  const [chartSpacingMode, language] = await Promise.all([
    getChartSpacingMode(req.userId),
    getLanguage(req.userId),
  ])
  res.json({ chartSpacingMode, language })
})

app.put('/api/settings', requireAuth, async (req, res) => {
  const chartSpacingMode = req.body?.chartSpacingMode
  const language = req.body?.language
  const hasSpacingMode = chartSpacingMode === 'equal' || chartSpacingMode === 'actual'
  const hasLanguage = language === 'ko' || language === 'en'

  if (!hasSpacingMode && !hasLanguage) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  if (hasSpacingMode) {
    await db.run(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES (?, 'chart_spacing_mode', ?, datetime('now'))
       ON CONFLICT(user_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`,
      [req.userId, chartSpacingMode],
    )
  }

  if (hasLanguage) {
    await db.run(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES (?, 'language', ?, datetime('now'))
       ON CONFLICT(user_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`,
      [req.userId, language],
    )
  }

  res.json({ ok: true })
})

app.get('/api/goals', requireAuth, async (req, res) => {
  const goals = await listGoals(req.userId)
  res.json(goals)
})

app.post('/api/goals', requireAuth, async (req, res) => {
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const result = await db.run(
    `INSERT INTO goals (name, target_date, target_level, unit, user_id) VALUES (?, ?, ?, ?, ?)`,
    [String(name).trim(), targetDate, Number(targetLevel), String(unit).trim(), req.userId],
  )

  res.status(201).json({ id: result.lastID })
})

app.put('/api/goals/:goalId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!goalId || !name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const result = await db.run(
    `UPDATE goals
     SET name = ?, target_date = ?, target_level = ?, unit = ?
     WHERE id = ? AND user_id = ?`,
    [String(name).trim(), targetDate, Number(targetLevel), String(unit).trim(), goalId, req.userId],
  )

  if (!result.changes) {
    res.status(404).json({ message: 'goal not found' })
    return
  }

  res.json({ ok: true })
})

app.delete('/api/goals/:goalId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)

  if (!goalId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const ownedGoal = await db.get(`SELECT id FROM goals WHERE id = ? AND user_id = ?`, [goalId, req.userId])
  if (!ownedGoal) {
    res.status(404).json({ message: 'goal not found' })
    return
  }

  await db.run(`DELETE FROM goal_records WHERE goal_id = ?`, [goalId])
  await db.run(`DELETE FROM goals WHERE id = ? AND user_id = ?`, [goalId, req.userId])

  res.json({ ok: true })
})

app.post('/api/goals/:goalId/records', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const ownedGoal = await db.get(`SELECT id FROM goals WHERE id = ? AND user_id = ?`, [goalId, req.userId])
  if (!ownedGoal) {
    res.status(404).json({ message: 'goal not found' })
    return
  }

  const normalizedMessage = String(message ?? '').trim() || null

  const result = await db.run(
    `INSERT INTO goal_records (goal_id, date, level, message) VALUES (?, ?, ?, ?)`,
    [goalId, date, Number(level), normalizedMessage],
  )

  res.status(201).json({ id: result.lastID })
})

app.put('/api/goals/:goalId/records/:recordId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !recordId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const ownedGoal = await db.get(`SELECT id FROM goals WHERE id = ? AND user_id = ?`, [goalId, req.userId])
  if (!ownedGoal) {
    res.status(404).json({ message: 'goal not found' })
    return
  }

  const normalizedMessage = String(message ?? '').trim() || null

  const result = await db.run(
    `UPDATE goal_records
     SET date = ?, level = ?, message = ?
     WHERE id = ? AND goal_id = ?`,
    [date, Number(level), normalizedMessage, recordId, goalId],
  )

  if (!result.changes) {
    res.status(404).json({ message: 'record not found' })
    return
  }

  res.json({ ok: true })
})

app.delete('/api/goals/:goalId/records/:recordId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)

  if (!goalId || !recordId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const ownedGoal = await db.get(`SELECT id FROM goals WHERE id = ? AND user_id = ?`, [goalId, req.userId])
  if (!ownedGoal) {
    res.status(404).json({ message: 'goal not found' })
    return
  }

  const result = await db.run(`DELETE FROM goal_records WHERE id = ? AND goal_id = ?`, [recordId, goalId])
  if (!result.changes) {
    res.status(404).json({ message: 'record not found' })
    return
  }

  res.json({ ok: true })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on http://0.0.0.0:${port}`)
})
