import cors from 'cors'
import express from 'express'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, 'data.sqlite')

const app = express()
const port = Number(process.env.API_PORT || 8787)

app.use(cors())
app.use(express.json())

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
})

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

const mapGoal = (row) => ({
  id: row.id,
  name: row.name,
  targetDate: row.target_date,
  targetLevel: row.target_level,
  unit: row.unit,
  inputs: [],
})

async function listGoals() {
  const goals = (await db.all(`SELECT id, name, target_date, target_level, unit FROM goals ORDER BY id DESC`)).map(mapGoal)

  if (goals.length === 0) {
    return []
  }

  const records = await db.all(`
    SELECT id, goal_id, date, level, message
    FROM goal_records
    ORDER BY date DESC, id DESC
  `)

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

async function getChartSpacingMode() {
  const row = await db.get(`SELECT value FROM app_settings WHERE key = 'chart_spacing_mode'`)
  const value = row?.value
  return value === 'actual' ? 'actual' : 'equal'
}

async function getLanguage() {
  const row = await db.get(`SELECT value FROM app_settings WHERE key = 'language'`)
  const value = row?.value
  return value === 'en' ? 'en' : 'ko'
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/settings', async (_req, res) => {
  const [chartSpacingMode, language] = await Promise.all([getChartSpacingMode(), getLanguage()])
  res.json({ chartSpacingMode, language })
})

app.put('/api/settings', async (req, res) => {
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
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('chart_spacing_mode', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [chartSpacingMode],
    )
  }

  if (hasLanguage) {
    await db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('language', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [language],
    )
  }

  res.json({ ok: true })
})

app.get('/api/goals', async (_req, res) => {
  const goals = await listGoals()
  res.json(goals)
})

app.post('/api/goals', async (req, res) => {
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const result = await db.run(
    `INSERT INTO goals (name, target_date, target_level, unit) VALUES (?, ?, ?, ?)`,
    [String(name).trim(), targetDate, Number(targetLevel), String(unit).trim()],
  )

  res.status(201).json({ id: result.lastID })
})

app.put('/api/goals/:goalId', async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!goalId || !name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  await db.run(
    `UPDATE goals SET name = ?, target_date = ?, target_level = ?, unit = ? WHERE id = ?`,
    [String(name).trim(), targetDate, Number(targetLevel), String(unit).trim(), goalId],
  )

  res.json({ ok: true })
})

app.delete('/api/goals/:goalId', async (req, res) => {
  const goalId = Number(req.params.goalId)

  if (!goalId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  await db.run(`DELETE FROM goal_records WHERE goal_id = ?`, [goalId])
  await db.run(`DELETE FROM goals WHERE id = ?`, [goalId])

  res.json({ ok: true })
})

app.post('/api/goals/:goalId/records', async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const normalizedMessage = String(message ?? '').trim() || null

  const result = await db.run(
    `INSERT INTO goal_records (goal_id, date, level, message) VALUES (?, ?, ?, ?)`,
    [goalId, date, Number(level), normalizedMessage],
  )

  res.status(201).json({ id: result.lastID })
})

app.put('/api/goals/:goalId/records/:recordId', async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !recordId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  const normalizedMessage = String(message ?? '').trim() || null

  await db.run(
    `UPDATE goal_records SET date = ?, level = ?, message = ? WHERE id = ? AND goal_id = ?`,
    [date, Number(level), normalizedMessage, recordId, goalId],
  )

  res.json({ ok: true })
})

app.delete('/api/goals/:goalId/records/:recordId', async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)

  if (!goalId || !recordId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  await db.run(`DELETE FROM goal_records WHERE id = ? AND goal_id = ?`, [recordId, goalId])
  res.json({ ok: true })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on http://0.0.0.0:${port}`)
})
