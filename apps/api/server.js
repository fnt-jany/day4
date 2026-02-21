import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'

const app = express()
const port = Number(process.env.API_PORT || 8787)
const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret'
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const googleClient = new OAuth2Client(googleClientId)
const MAX_GOALS_PER_USER = 10
const MAX_RECORDS_PER_GOAL = 100

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



const getUserSetting = async (userId, key) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.value ?? null
}

const setUserSetting = async (userId, key, value) => {
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,key' },
  )

  if (error) {
    throw error
  }
}

const deleteUserSetting = async (userId, key) => {
  const { error } = await supabase.from('user_settings').delete().eq('user_id', userId).eq('key', key)
  if (error) {
    throw error
  }
}

const hashChatbotApiKey = (apiKey) => createHash('sha256').update(apiKey).digest('hex')

const isDuplicatePrimaryKeyError = (error) => {
  return error?.code === '23505' && String(error?.message || '').includes('_pkey')
}

const getNextId = async (table) => {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .order('id', { ascending: false })
    .limit(1)

  if (error) {
    throw error
  }

  const currentMax = data && data.length > 0 ? Number(data[0].id) : 0
  return currentMax + 1
}

const insertWithNextId = async (table, payload, maxRetries = 5) => {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const id = await getNextId(table)
    const { data, error } = await supabase
      .from(table)
      .insert({ id, ...payload })
      .select('id')
      .single()

    if (!error) {
      return data
    }

    if (isDuplicatePrimaryKeyError(error)) {
      continue
    }

    throw error
  }

  throw new Error(`failed to allocate id for table ${table}`)
}

const upsertUserByGoogleSub = async ({ googleSub, email, name, pictureUrl }) => {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id')
    .eq('google_sub', googleSub)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email,
        name,
        picture_url: pictureUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      throw updateError
    }
  } else {
    await insertWithNextId('users', {
      google_sub: googleSub,
      email,
      name,
      picture_url: pictureUrl,
      updated_at: new Date().toISOString(),
    })
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, picture_url')
    .eq('google_sub', googleSub)
    .single()

  if (userError) {
    throw userError
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.picture_url ?? null,
  }
}

async function getOrCreateGuestUser() {
  return upsertUserByGoogleSub({
    googleSub: 'guest-mode',
    email: null,
    name: 'Guest',
    pictureUrl: null,
  })
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

const resolveUserByChatbotApiKey = async (apiKey) => {
  if (!apiKey || !apiKey.startsWith('day4_ck_')) {
    return null
  }

  const keyHash = hashChatbotApiKey(apiKey)
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('key', 'chatbot_api_key_hash')
    .eq('value', keyHash)
    .limit(1)

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return null
  }

  const userId = Number(data[0].user_id)
  if (!userId) {
    return null
  }

  return getUserById(userId)
}

const requireChatbotAuth = async (req, res, next) => {
  const token = getToken(req)
  if (!token) {
    res.status(401).json({ message: 'chatbot unauthorized' })
    return
  }

  try {
    const user = await resolveUserByChatbotApiKey(token)
    if (!user) {
      res.status(401).json({ message: 'chatbot unauthorized' })
      return
    }

    req.userId = user.id
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'chatbot unauthorized' })
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
    .select('id, name')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getGoalCountForUser = async (userId) => {
  const { data, error } = await supabase.from('goals').select('id').eq('user_id', userId)
  if (error) {
    throw error
  }
  return (data || []).length
}

const getRecordCountForGoal = async (goalId) => {
  const { data, error } = await supabase.from('goal_records').select('id').eq('goal_id', goalId)
  if (error) {
    throw error
  }
  return (data || []).length
}

const findGoalByName = async (goalName, userId) => {
  const normalized = String(goalName || '').trim()
  if (!normalized) {
    return null
  }

  const { data, error } = await supabase
    .from('goals')
    .select('id, name')
    .eq('user_id', userId)
    .eq('name', normalized)
    .order('id', { ascending: false })
    .limit(2)

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return null
  }

  if (data.length > 1) {
    return { ambiguous: true }
  }

  return data[0]
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

    const user = await upsertUserByGoogleSub({
      googleSub,
      email: payload.email || null,
      name: payload.name || null,
      pictureUrl: payload.picture || null,
    })

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

app.get('/api/chatbot/api-key', requireAuth, async (req, res) => {
  try {
    const [keyHash, keyPrefix, issuedAt, apiKey] = await Promise.all([
      getUserSetting(req.userId, 'chatbot_api_key_hash'),
      getUserSetting(req.userId, 'chatbot_api_key_prefix'),
      getUserSetting(req.userId, 'chatbot_api_key_issued_at'),
      getUserSetting(req.userId, 'chatbot_api_key_value'),
    ])

    res.json({
      hasKey: Boolean(keyHash),
      keyPrefix: keyPrefix ?? null,
      issuedAt: issuedAt ?? null,
      apiKey: keyHash ? apiKey ?? null : null,
    })
  } catch (error) {
    console.error('chatbot api key read failed', error)
    res.status(500).json({ message: 'failed to read chatbot api key' })
  }
})

app.post('/api/chatbot/api-key/issue', requireAuth, async (req, res) => {
  try {
    const rawKey = `day4_ck_${randomBytes(24).toString('base64url')}`
    const keyHash = hashChatbotApiKey(rawKey)
    const keyPrefix = rawKey.slice(0, 16)
    const issuedAt = new Date().toISOString()

    await Promise.all([
      setUserSetting(req.userId, 'chatbot_api_key_hash', keyHash),
      setUserSetting(req.userId, 'chatbot_api_key_prefix', keyPrefix),
      setUserSetting(req.userId, 'chatbot_api_key_issued_at', issuedAt),
      setUserSetting(req.userId, 'chatbot_api_key_value', rawKey),
    ])

    res.json({
      apiKey: rawKey,
      keyPrefix,
      issuedAt,
      warning: 'Store this key now. It is shown only once.',
    })
  } catch (error) {
    console.error('chatbot api key issue failed', error)
    res.status(500).json({ message: 'failed to issue chatbot api key' })
  }
})

app.delete('/api/chatbot/api-key', requireAuth, async (req, res) => {
  try {
    await Promise.all([
      deleteUserSetting(req.userId, 'chatbot_api_key_hash'),
      deleteUserSetting(req.userId, 'chatbot_api_key_prefix'),
      deleteUserSetting(req.userId, 'chatbot_api_key_issued_at'),
      deleteUserSetting(req.userId, 'chatbot_api_key_value'),
    ])

    res.json({ ok: true })
  } catch (error) {
    console.error('chatbot api key revoke failed', error)
    res.status(500).json({ message: 'failed to revoke chatbot api key' })
  }
})

app.get('/api/chatbot/goals', requireChatbotAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('id, name, target_date, target_level, unit')
      .eq('user_id', req.userId)
      .order('id', { ascending: false })

    if (error) {
      throw error
    }

    res.json(
      (data || []).map((goal) => ({
        id: goal.id,
        name: goal.name,
        targetDate: goal.target_date,
        targetLevel: goal.target_level,
        unit: goal.unit,
      })),
    )
  } catch (error) {
    console.error('chatbot goals read failed', error)
    res.status(500).json({ message: 'failed to read chatbot goals' })
  }
})

const parseChatbotRecordPayload = (payload) => {
  const goalId = Number(payload?.goalId)
  const goalName = payload?.goalName
  const date = payload?.date
  const level = payload?.level
  const message = payload?.message

  if ((!goalId && !goalName) || !date || Number.isNaN(Number(level))) {
    return { ok: false, status: 400, message: 'invalid payload' }
  }

  return {
    ok: true,
    value: {
      goalId: goalId || null,
      goalName,
      date,
      level: Number(level),
      message: String(message ?? '').trim() || null,
    },
  }
}

const createChatbotRecordForUser = async (userId, payload) => {
  const parsed = parseChatbotRecordPayload(payload)
  if (!parsed.ok) {
    return parsed
  }

  const { goalId, goalName, date, level, message } = parsed.value

  let goal = null
  if (goalId) {
    goal = await ensureOwnedGoal(goalId, userId)
    if (!goal) {
      return { ok: false, status: 404, message: 'goal not found' }
    }
  } else {
    const byName = await findGoalByName(goalName, userId)
    if (!byName) {
      return { ok: false, status: 404, message: 'goal not found' }
    }
    if (byName.ambiguous) {
      return { ok: false, status: 409, message: 'goal name is ambiguous. use goalId.' }
    }
    goal = byName
  }

  const recordCount = await getRecordCountForGoal(goal.id)
  if (recordCount >= MAX_RECORDS_PER_GOAL) {
    return { ok: false, status: 409, message: `record limit reached (${MAX_RECORDS_PER_GOAL})` }
  }

  const data = await insertWithNextId('goal_records', {
    goal_id: goal.id,
    date,
    level,
    message,
  })

  return {
    ok: true,
    goalId: goal.id,
    goalName: goal.name,
    recordId: data.id,
  }
}

const resolveChatbotGoalForUser = async (userId, { goalId, goalName }) => {
  const parsedGoalId = Number(goalId)
  const normalizedGoalName = typeof goalName === 'string' ? goalName.trim() : ''

  if (!parsedGoalId && !normalizedGoalName) {
    return { ok: false, status: 400, message: 'goalId or goalName is required' }
  }

  if (parsedGoalId) {
    const goal = await ensureOwnedGoal(parsedGoalId, userId)
    if (!goal) {
      return { ok: false, status: 404, message: 'goal not found' }
    }
    return { ok: true, goal }
  }

  const byName = await findGoalByName(normalizedGoalName, userId)
  if (!byName) {
    return { ok: false, status: 404, message: 'goal not found' }
  }
  if (byName.ambiguous) {
    return { ok: false, status: 409, message: 'goal name is ambiguous. use goalId.' }
  }

  return { ok: true, goal: byName }
}

const getOwnedChatbotRecord = async (recordId, userId) => {
  const { data, error } = await supabase
    .from('goal_records')
    .select('id, goal_id, date, level, message')
    .eq('id', recordId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const ownedGoal = await ensureOwnedGoal(data.goal_id, userId)
  if (!ownedGoal) {
    return null
  }

  return {
    id: data.id,
    goalId: data.goal_id,
    goalName: ownedGoal.name,
    date: data.date,
    level: data.level,
    message: data.message ?? null,
  }
}

app.post('/api/chatbot/records', requireChatbotAuth, async (req, res) => {
  try {
    const result = await createChatbotRecordForUser(req.userId, req.body)

    if (!result.ok) {
      res.status(result.status).json({ message: result.message })
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('chatbot record create failed', error)
    res.status(500).json({ message: 'failed to create chatbot record' })
  }
})

app.post('/api/chatbot/records/batch', requireChatbotAuth, async (req, res) => {
  const records = req.body?.records
  const maxBatchSize = 50

  if (!Array.isArray(records) || records.length === 0 || records.length > maxBatchSize) {
    res.status(400).json({ message: `records must be an array of 1..${maxBatchSize}` })
    return
  }

  try {
    const success = []
    const failed = []

    for (let index = 0; index < records.length; index += 1) {
      const payload = records[index]
      try {
        const result = await createChatbotRecordForUser(req.userId, payload)
        if (!result.ok) {
          failed.push({ index, status: result.status, message: result.message })
          continue
        }
        success.push({
          index,
          goalId: result.goalId,
          goalName: result.goalName,
          recordId: result.recordId,
        })
      } catch (error) {
        failed.push({ index, status: 500, message: String(error?.message || error) })
      }
    }

    res.status(200).json({
      ok: failed.length === 0,
      total: records.length,
      inserted: success.length,
      failedCount: failed.length,
      success,
      failed,
    })
  } catch (error) {
    console.error('chatbot batch record create failed', error)
    res.status(500).json({ message: 'failed to create chatbot records batch' })
  }
})

app.get('/api/chatbot/records', requireChatbotAuth, async (req, res) => {
  const goalId = req.query?.goalId
  const goalName = req.query?.goalName
  const requestedLimit = Number(req.query?.limit)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100

  try {
    const resolved = await resolveChatbotGoalForUser(req.userId, { goalId, goalName })
    if (!resolved.ok) {
      res.status(resolved.status).json({ message: resolved.message })
      return
    }

    const { data, error } = await supabase
      .from('goal_records')
      .select('id, goal_id, date, level, message')
      .eq('goal_id', resolved.goal.id)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    res.json({
      goalId: resolved.goal.id,
      goalName: resolved.goal.name,
      count: (data || []).length,
      records: (data || []).map((record) => ({
        id: record.id,
        goalId: record.goal_id,
        date: record.date,
        level: record.level,
        message: record.message ?? null,
      })),
    })
  } catch (error) {
    console.error('chatbot records read failed', error)
    res.status(500).json({ message: 'failed to read chatbot records' })
  }
})

app.put('/api/chatbot/records/:recordId', requireChatbotAuth, async (req, res) => {
  const recordId = Number(req.params.recordId)
  const { goalId, goalName, date, level, message } = req.body ?? {}

  if (!recordId || !date || Number.isNaN(Number(level))) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const record = await getOwnedChatbotRecord(recordId, req.userId)
    if (!record) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    if (goalId || goalName) {
      const resolved = await resolveChatbotGoalForUser(req.userId, { goalId, goalName })
      if (!resolved.ok) {
        res.status(resolved.status).json({ message: resolved.message })
        return
      }
      if (resolved.goal.id !== record.goalId) {
        res.status(409).json({ message: 'record does not belong to goal' })
        return
      }
    }

    const normalizedMessage = String(message ?? '').trim() || null
    const { data, error } = await supabase
      .from('goal_records')
      .update({
        date,
        level: Number(level),
        message: normalizedMessage,
      })
      .eq('id', recordId)
      .eq('goal_id', record.goalId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    res.json({
      ok: true,
      recordId,
      goalId: record.goalId,
      goalName: record.goalName,
    })
  } catch (error) {
    console.error('chatbot record update failed', error)
    res.status(500).json({ message: 'failed to update chatbot record' })
  }
})

app.delete('/api/chatbot/records/:recordId', requireChatbotAuth, async (req, res) => {
  const recordId = Number(req.params.recordId)
  const { goalId, goalName } = req.body ?? {}

  if (!recordId) {
    res.status(400).json({ message: 'invalid payload' })
    return
  }

  try {
    const record = await getOwnedChatbotRecord(recordId, req.userId)
    if (!record) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    if (goalId || goalName) {
      const resolved = await resolveChatbotGoalForUser(req.userId, { goalId, goalName })
      if (!resolved.ok) {
        res.status(resolved.status).json({ message: resolved.message })
        return
      }
      if (resolved.goal.id !== record.goalId) {
        res.status(409).json({ message: 'record does not belong to goal' })
        return
      }
    }

    const { data, error } = await supabase
      .from('goal_records')
      .delete()
      .eq('id', recordId)
      .eq('goal_id', record.goalId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ message: 'record not found' })
      return
    }

    res.json({
      ok: true,
      recordId,
      goalId: record.goalId,
      goalName: record.goalName,
    })
  } catch (error) {
    console.error('chatbot record delete failed', error)
    res.status(500).json({ message: 'failed to delete chatbot record' })
  }
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
    const goalCount = await getGoalCountForUser(req.userId)
    if (goalCount >= MAX_GOALS_PER_USER) {
      res.status(409).json({ message: `goal limit reached (${MAX_GOALS_PER_USER})` })
      return
    }

    const data = await insertWithNextId('goals', {
      name: String(name).trim(),
      target_date: targetDate,
      target_level: Number(targetLevel),
      unit: String(unit).trim(),
      user_id: req.userId,
    })

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

    const recordCount = await getRecordCountForGoal(goalId)
    if (recordCount >= MAX_RECORDS_PER_GOAL) {
      res.status(409).json({ message: `record limit reached (${MAX_RECORDS_PER_GOAL})` })
      return
    }

    const normalizedMessage = String(message ?? '').trim() || null

    const data = await insertWithNextId('goal_records', {
      goal_id: goalId,
      date,
      level: Number(level),
      message: normalizedMessage,
    })

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


