import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'

const app = express()
const port = Number(process.env.API_PORT || 8787)
const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret'
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const googleClient = new OAuth2Client(googleClientId)

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

app.use(cors())
app.use(express.json())

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

const getUserById = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, picture_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    pictureUrl: data.picture_url ?? null,
  }
}

async function getOrCreateGuestUser() {
  const payload = {
    google_sub: 'guest-mode',
    email: null,
    name: 'Guest',
    picture_url: null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('users').upsert(payload, {
    onConflict: 'google_sub',
  })

  if (error) {
    throw error
  }

  const { data: user, error: selectError } = await supabase
    .from('users')
    .select('id, email, name, picture_url')
    .eq('google_sub', 'guest-mode')
    .single()

  if (selectError) {
    throw selectError
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.picture_url ?? null,
  }
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

    const user = await getUserById(userId)
    if (!user) {
      res.status(401).json({ message: 'unauthorized' })
      return
    }

    req.userId = user.id
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'unauthorized' })
  }
}

async function listGoals(userId) {
  const { data: goalRows, error: goalsError } = await supabase
    .from('goals')
    .select('id, name, target_date, target_level, unit')
    .eq('user_id', userId)
    .order('id', { ascending: false })

  if (goalsError) {
    throw goalsError
  }

  const goals = (goalRows || []).map(mapGoal)

  if (goals.length === 0) {
    return []
  }

  const goalIds = goals.map((goal) => goal.id)
  const { data: recordRows, error: recordsError } = await supabase
    .from('goal_records')
    .select('id, goal_id, date, level, message')
    .in('goal_id', goalIds)
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (recordsError) {
    throw recordsError
  }

  const byGoal = new Map(goals.map((goal) => [goal.id, goal]))
  for (const record of recordRows || []) {
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
  const { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'chart_spacing_mode')
    .maybeSingle()

  if (error) {
    throw error
  }

  const value = data?.value
  return value === 'actual' ? 'actual' : 'equal'
}

async function getLanguage(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'language')
    .maybeSingle()

  if (error) {
    throw error
  }

  const value = data?.value
  return value === 'en' ? 'en' : 'ko'
}

const ensureOwnedGoal = async (goalId, userId) => {
  const { data, error } = await supabase
    .from('goals')
    .select('id')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/guest', async (_req, res) => {
  try {
    const user = await getOrCreateGuestUser()
    const token = jwt.sign({ userId: user.id, sub: 'guest-mode' }, jwtSecret, {
      expiresIn: '7d',
    })

    res.json({ token, user })
  } catch (error) {
    console.error('guest auth failed', error)
    res.status(500).json({ message: 'guest auth failed' })
  }
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

    const userPayload = {
      google_sub: googleSub,
      email: payload.email || null,
      name: payload.name || null,
      picture_url: payload.picture || null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase.from('users').upsert(userPayload, {
      onConflict: 'google_sub',
    })

    if (upsertError) {
      throw upsertError
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, name, picture_url')
      .eq('google_sub', googleSub)
      .single()

    if (userError) {
      throw userError
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      pictureUrl: userRow.picture_url ?? null,
    }

    const token = jwt.sign({ userId: user.id, sub: googleSub }, jwtSecret, {
      expiresIn: '7d',
    })

    res.json({ token, user })
  } catch (error) {
    console.error('google auth failed', error)
    res.status(401).json({ message: 'invalid token' })
  }
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user })
})

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const [chartSpacingMode, language] = await Promise.all([
      getChartSpacingMode(req.userId),
      getLanguage(req.userId),
    ])
    res.json({ chartSpacingMode, language })
  } catch (error) {
    console.error('settings read failed', error)
    res.status(500).json({ message: 'failed to read settings' })
  }
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

  try {
    if (hasSpacingMode) {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: req.userId,
          key: 'chart_spacing_mode',
          value: chartSpacingMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )

      if (error) {
        throw error
      }
    }

    if (hasLanguage) {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: req.userId,
          key: 'language',
          value: language,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )

      if (error) {
        throw error
      }
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('settings update failed', error)
    res.status(500).json({ message: 'failed to update settings' })
  }
})

app.get('/api/goals', requireAuth, async (req, res) => {
  try {
    const goals = await listGoals(req.userId)
    res.json(goals)
  } catch (error) {
    console.error('goals read failed', error)
    res.status(500).json({ message: 'failed to read goals' })
  }
})

app.post('/api/goals', requireAuth, async (req, res) => {
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const { data, error } = await supabase
      .from('goals')
      .insert({
        name: String(name).trim(),
        target_date: targetDate,
        target_level: Number(targetLevel),
        unit: String(unit).trim(),
        user_id: req.userId,
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    res.status(201).json({ id: data.id })
  } catch (error) {
    console.error('goal create failed', error)
    res.status(500).json({ message: 'failed to create goal' })
  }
})

app.put('/api/goals/:goalId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { name, targetDate, targetLevel, unit } = req.body ?? {}

  if (!goalId || !name || !targetDate || !unit || Number.isNaN(Number(targetLevel))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const { data, error } = await supabase
      .from('goals')
      .update({
        name: String(name).trim(),
        target_date: targetDate,
        target_level: Number(targetLevel),
        unit: String(unit).trim(),
      })
      .eq('id', goalId)
      .eq('user_id', req.userId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('goal update failed', error)
    res.status(500).json({ message: 'failed to update goal' })
  }
})

app.delete('/api/goals/:goalId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)

  if (!goalId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const ownedGoal = await ensureOwnedGoal(goalId, req.userId)
    if (!ownedGoal) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    const { data, error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', req.userId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('goal delete failed', error)
    res.status(500).json({ message: 'failed to delete goal' })
  }
})

app.post('/api/goals/:goalId/records', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const ownedGoal = await ensureOwnedGoal(goalId, req.userId)
    if (!ownedGoal) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    const normalizedMessage = String(message ?? '').trim() || null

    const { data, error } = await supabase
      .from('goal_records')
      .insert({
        goal_id: goalId,
        date,
        level: Number(level),
        message: normalizedMessage,
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    res.status(201).json({ id: data.id })
  } catch (error) {
    console.error('record create failed', error)
    res.status(500).json({ message: 'failed to create record' })
  }
})

app.put('/api/goals/:goalId/records/:recordId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)
  const { date, level, message } = req.body ?? {}

  if (!goalId || !recordId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const ownedGoal = await ensureOwnedGoal(goalId, req.userId)
    if (!ownedGoal) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    const normalizedMessage = String(message ?? '').trim() || null

    const { data, error } = await supabase
      .from('goal_records')
      .update({ date, level: Number(level), message: normalizedMessage })
      .eq('id', recordId)
      .eq('goal_id', goalId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('record update failed', error)
    res.status(500).json({ message: 'failed to update record' })
  }
})

app.delete('/api/goals/:goalId/records/:recordId', requireAuth, async (req, res) => {
  const goalId = Number(req.params.goalId)
  const recordId = Number(req.params.recordId)

  if (!goalId || !recordId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const ownedGoal = await ensureOwnedGoal(goalId, req.userId)
    if (!ownedGoal) {
      res.status(404).json({ message: 'goal not found' })
      return
    }

    const { data, error } = await supabase
      .from('goal_records')
      .delete()
      .eq('id', recordId)
      .eq('goal_id', goalId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('record delete failed', error)
    res.status(500).json({ message: 'failed to delete record' })
  }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on http://0.0.0.0:${port}`)
})
