import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlitePath = path.resolve(__dirname, '..', 'data.sqlite')

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

const sqliteDb = await open({
  filename: sqlitePath,
  driver: sqlite3.Database,
})

const chunk = (array, size) => {
  const out = []
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size))
  }
  return out
}

const upsertChunks = async (table, rows, onConflict) => {
  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(part, { onConflict })
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`)
    }
  }
}

try {
  const [users, goals, goalRecords, userSettings] = await Promise.all([
    sqliteDb.all('SELECT id, google_sub, email, name, picture_url, created_at, updated_at FROM users'),
    sqliteDb.all('SELECT id, user_id, name, target_date, target_level, unit, created_at FROM goals'),
    sqliteDb.all('SELECT id, goal_id, date, level, message, created_at FROM goal_records'),
    sqliteDb.all('SELECT user_id, key, value, updated_at FROM user_settings'),
  ])

  if (users.length > 0) await upsertChunks('users', users, 'id')
  if (goals.length > 0) await upsertChunks('goals', goals, 'id')
  if (goalRecords.length > 0) await upsertChunks('goal_records', goalRecords, 'id')
  if (userSettings.length > 0) await upsertChunks('user_settings', userSettings, 'user_id,key')

  console.log('Migration complete')
  console.log(`users: ${users.length}`)
  console.log(`goals: ${goals.length}`)
  console.log(`goal_records: ${goalRecords.length}`)
  console.log(`user_settings: ${userSettings.length}`)
} finally {
  await sqliteDb.close()
}
