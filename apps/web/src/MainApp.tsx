import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'
import { THEMES, DEFAULT_THEME_ID, applyThemeById, normalizeThemeId } from './themes'

type GoalInput = {
  id: number
  date: string
  level: number
  message?: string
  createdAt?: string
}

type Goal = {
  id: number
  name: string
  targetDate: string
  targetLevel: number
  unit: string
  inputs: GoalInput[]
}

type GoalFormState = {
  name: string
  targetDate: string
  targetLevel: string
  unit: string
}

type InputFormState = {
  date: string
  level: string
  message: string
}

type ChartSpacingMode = 'equal' | 'actual'
type Language = 'ko' | 'en'

type TrendChartProps = {
  records: GoalInput[]
  targetLevel: number
  unit: string
  spacingMode: ChartSpacingMode
  text: {
    noRecordsForChart: string
    tooltipDate: string
    tooltipLevel: string
    tooltipMessage: string
    legendRecords: string
    legendTarget: string
    legendTrend: string
    progressChartAria: string
  }
}

type MiniTrendChartProps = {
  records: GoalInput[]
  targetLevel: number
  spacingMode: ChartSpacingMode
  emptyLabel: string
  ariaLabel: string
}

type ChartPoint = GoalInput & {
  x: number
  y: number
}

type SettingsResponse = {
  chartSpacingMode: ChartSpacingMode
  language: Language
  themeId?: string
}

type ChatbotApiKeyStatusResponse = {
  hasKey: boolean
  keyPrefix: string | null
  issuedAt: string | null
  apiKey: string | null
}

type ChatbotApiKeyIssueResponse = {
  apiKey: string
  keyPrefix: string
  issuedAt: string
  warning: string
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

function GoalListAdCard() {
  const adRef = useRef<HTMLModElement | null>(null)

  useEffect(() => {
    if (!adRef.current || !window.adsbygoogle) {
      return
    }

    if (adRef.current.dataset.adLoaded === 'true') {
      return
    }

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      adRef.current.dataset.adLoaded = 'true'
    } catch {
      // Ignore AdSense push errors during local/dev rendering.
    }
  }, [])

  return (
    <li className="goal-ad-item" aria-hidden="true">
      <div className="goal-ad-card">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '220px' }}
          data-ad-client="ca-pub-8815573688398796"
          data-ad-slot="7011992520"
        />
      </div>
    </li>
  )
}

const getGoalAdInsertIndexes = (goals: Goal[]) => {
  const indexes = new Set<number>()
  if (goals.length < 3) {
    return indexes
  }

  const seed = goals.reduce((acc, goal, index) => (acc + goal.id * (index + 11)) % 9973, 17)
  let cursor = 1 + (seed % 2)
  let stepSeed = seed

  while (cursor < goals.length - 1) {
    indexes.add(cursor)
    stepSeed = (stepSeed * 1103515245 + 12345) & 0x7fffffff
    cursor += 2 + (stepSeed % 2)
  }

  return indexes
}

const TEXT = {
  ko: {
    appTitle: '\uC791\uC2EC\uC0AC\uC77C',
    settings: '\uC124\uC815',
    chatbotGuide: '\uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
    mcpGuide: 'MCP \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
    addGoal: '\uBAA9\uD45C \uCD94\uAC00',
    chartSpacingLabel: '\uADF8\uB798\uD504 X\uCD95 \uAC04\uACA9',
    equalSpacing: '\uB4F1\uAC04\uACA9',
    actualSpacing: '\uC2E4\uC81C\uAC04\uACA9',
    languageLabel: '\uC5B8\uC5B4',
    korean: '\uD55C\uAD6D\uC5B4',
    english: '\uC601\uC5B4',
    themeLabel: '\uD14C\uB9C8',
    logout: '\uB85C\uADF8\uC544\uC6C3',
    chatbotApiKeyTitle: '\uCC57\uBD07 API \uD0A4',
    chatbotApiKeyDesc: '외부 챗봇에서 상태 입력 시 사용할 사용자 전용 키입니다.',
    chatbotApiKeyIssue: '키 발급/재발급',
    chatbotApiKeyCopy: '키 복사',
    chatbotApiKeyRevoke: '키 폐기',
    chatbotApiKeyMissing: '발급된 키 없음',
    chatbotApiKeyActivePrefix: '현재 키 Prefix',
    chatbotApiKeyIssuedAt: '발급 시각',
    chatbotApiKeyShownOnce: '아래 키는 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.',
    chatbotApiKeyLegacyNotice: '기존 키는 복구가 불가합니다. 복사 버튼을 누르면 자동 재발급됩니다.',
    chatbotApiKeyCopied: '키가 클립보드에 복사되었습니다.',
    loading: '불러오는 중...',
    goalEdit: '목표 수정',
    goalCreate: '목표 추가',
    name: '이름',
    namePlaceholder: '예: 체중 감량',
    targetDate: '목표일',
    targetLevel: '목표수준',
    targetLevelPlaceholder: '예: 10',
    unit: '수준단위',
    unitPlaceholder: '예: kg, 분, 페이지',
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    confirmDeleteGoal: '이 목표를 삭제할까요?',
    confirmDeleteRecord: '이 기록을 삭제할까요?',
    statusInput: '기록 입력',
    recordEdit: '기록 수정',
    date: '날짜',
    currentLevel: '현재수준',
    messageOptional: '메시지 (선택)',
    messagePlaceholder: '예: 오늘은 컨디션이 좋았음',
    levelInputExample: '예',
    saveInput: '입력 저장',
    saveEdit: '수정 저장',
    recordView: '기록 보기',
    close: '닫기',
    recordList: '기록 목록',
    noRecords: '기록이 없습니다.',
    goalList: '목표 리스트',
    noGoalsYet: '아직 목표가 없습니다. 상단의 목표 추가 버튼을 눌러 시작하세요.',
    goalPrefix: '목표:',
    latestInput: '최근 입력:',
    goalTrendOnTrack: '달성 예상',
    goalTrendOffTrack: '미달 예상',
    goalTrendProjected: '추세 예측',
    none: '없음',
    enterStatus: '기록입력',
    viewRecords: '기록 보기',
    edit: '수정',
    reorderGoals: '순서 변경',
    finishReorder: '완료',    moveTop: '맨 위',
    moveUp: '위로',
    moveDown: '아래로',    moveBottom: '맨 아래',
    noRecordsForChart: '기록이 없어 그래프를 표시할 수 없습니다.',
    miniNoRecords: '기록 없음',
    legendRecords: '파란선: 기록',
    legendTarget: '빨간 점선: 목표수준',
    legendTrend: '초록 점선: 추세선',
    tooltipDate: '날짜',
    tooltipLevel: '수준',
    tooltipMessage: '메시지',
    miniProgressChartAria: '미니 진행 그래프',
    progressChartAria: '진행 그래프',
    errors: {
      loadData: '데이터를 불러오지 못했습니다. API 서버를 확인하세요.',
      loadSettings: '설정 값을 불러오지 못했습니다.',
      saveSettings: '설정 저장에 실패했습니다.',
      saveGoal: '목표 저장에 실패했습니다.',
      goalLimit: '목표는 최대 10개까지 만들 수 있습니다.',
      deleteGoal: '목표 삭제에 실패했습니다.',
      saveRecord: '기록 저장에 실패했습니다.',
      recordLimit: '기록은 목표당 최대 100개까지 저장할 수 있습니다.',
      deleteRecord: '기록 삭제에 실패했습니다.',
      saveGoalOrder: '목표 순서 저장에 실패했습니다.',
    },
  },  en: {
    appTitle: 'Day4',
    loginTitle: 'Google Login',
    loginDescription: 'Sign in with Google to separate goals and settings per user.',
    loginButtonHint: 'Loading sign-in button...',
    missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID is not configured.',
    signedInAs: 'Signed in as',
    logout: 'Log out',
    chatbotApiKeyTitle: 'Chatbot API Key',
    chatbotApiKeyDesc: 'User-scoped key for external chatbot status updates.',
    chatbotApiKeyIssue: 'Issue / Rotate Key',
    chatbotApiKeyCopy: 'Copy Key',
    chatbotApiKeyRevoke: 'Revoke Key',
    chatbotApiKeyMissing: 'No active key',
    chatbotApiKeyActivePrefix: 'Active key prefix',
    chatbotApiKeyIssuedAt: 'Issued at',
    chatbotApiKeyShownOnce: 'This full key is shown only once. Save it now.',
    chatbotApiKeyLegacyNotice: 'Existing key cannot be recovered. Copy will rotate and issue a new key.',
    chatbotApiKeyCopied: 'API key copied to clipboard.',
    settings: 'Settings',
    chatbotGuide: 'Chatbot Guide',
    mcpGuide: 'MCP Guide',
    addGoal: 'Add Goal',
    chartSpacingLabel: 'Chart X-Axis Spacing',
    equalSpacing: 'Equal Spacing',
    actualSpacing: 'Actual Spacing',
    languageLabel: 'Language',
    korean: 'Korean',
    english: 'English',
    themeLabel: 'Theme',
    loading: 'Loading...',
    goalEdit: 'Edit Goal',
    goalCreate: 'Create Goal',
    name: 'Name',
    namePlaceholder: 'e.g. Lose weight',
    targetDate: 'Target Date',
    targetLevel: 'Target Level',
    targetLevelPlaceholder: 'e.g. 10',
    unit: 'Unit',
    unitPlaceholder: 'e.g. kg, min, pages',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDeleteGoal: 'Delete this goal?',
    confirmDeleteRecord: 'Delete this record?',
    statusInput: 'Enter Status',
    recordEdit: 'Edit Record',
    date: 'Date',
    currentLevel: 'Current Level',
    messageOptional: 'Message (Optional)',
    messagePlaceholder: 'e.g. Felt good today',
    levelInputExample: 'e.g.',
    saveInput: 'Save Entry',
    saveEdit: 'Save Changes',
    recordView: 'View Records',
    close: 'Close',
    recordList: 'Record List',
    noRecords: 'No records yet.',
    goalList: 'Goal List',
    noGoalsYet: 'No goals yet. Click Add Goal to get started.',
    goalPrefix: 'Target:',
    latestInput: 'Latest entry:',
    goalTrendOnTrack: 'On track',
    goalTrendOffTrack: 'Off track',
    goalTrendProjected: 'Trend projection',
    none: 'None',
    enterStatus: 'Enter Status',
    viewRecords: 'View Records',
    edit: 'Edit',
    reorderGoals: 'Reorder goals',
    finishReorder: 'Done',
    moveTop: 'To top',
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveBottom: 'To bottom',
    noRecordsForChart: 'No records available to render this chart.',
    miniNoRecords: 'No records',
    legendRecords: 'Blue line: records',
    legendTarget: 'Red dashed line: target level',
    legendTrend: 'Green dashed line: trend',
    tooltipDate: 'Date',
    tooltipLevel: 'Level',
    tooltipMessage: 'Message',
    miniProgressChartAria: 'Mini progress chart',
    progressChartAria: 'Progress chart',
    errors: {
      loginFailed: 'Login failed. Please try again.',
      sessionExpired: 'Session expired. Logged out.',
      loadData: 'Failed to load data. Please check the API server.',
      loadSettings: 'Failed to load settings.',
      saveSettings: 'Failed to save settings.',
      saveGoal: 'Failed to save goal.',
      goalLimit: 'You can create up to 10 goals.',
      deleteGoal: 'Failed to delete goal.',
      saveRecord: 'Failed to save record.',
      recordLimit: 'You can store up to 100 records per goal.',
      deleteRecord: 'Failed to delete record.',
      saveGoalOrder: 'Failed to save goal order.',
    },
  },
} as const

const AUTH_TOKEN_KEY = 'day4_auth_token'
const DEFAULT_TIMEZONE = 'Asia/Seoul'
const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE?.trim() || DEFAULT_TIMEZONE

const createYmdFormatter = (timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
}

const todayFormatter = createYmdFormatter(APP_TIMEZONE)
const getToday = () => todayFormatter.format(new Date())

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:8787/api`

const compareRecordsAsc = (a: GoalInput, b: GoalInput) => {
  const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (dateDiff !== 0) return dateDiff

  const createdA = a.createdAt ? new Date(a.createdAt).getTime() : Number.NaN
  const createdB = b.createdAt ? new Date(b.createdAt).getTime() : Number.NaN
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) {
    return createdA - createdB
  }

  return a.id - b.id
}

const getRecordsByDateAsc = (records: GoalInput[]) =>
  [...records].sort(compareRecordsAsc)

const getLatestRecord = (records: GoalInput[]) =>
  [...records].sort((a, b) => compareRecordsAsc(b, a))[0]

type GoalTrendStatus = 'on_track' | 'off_track' | 'insufficient'

type GoalTrendAssessment = {
  status: GoalTrendStatus
  projectedLevel: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

const GOAL_LIMIT_API_MESSAGE = 'goal limit reached (10)'
const RECORD_LIMIT_API_MESSAGE = 'record limit reached (100)'

type ApiRequestError = Error & {
  status: number
  apiMessage: string | null
}

const getGoalTrendAssessment = (goal: Goal): GoalTrendAssessment => {
  const sorted = getRecordsByDateAsc(goal.inputs)

  if (sorted.length < 2) {
    return { status: 'insufficient', projectedLevel: null }
  }

  const firstTime = new Date(sorted[0].date).getTime()
  const targetTime = new Date(goal.targetDate).getTime()

  if (Number.isNaN(firstTime) || Number.isNaN(targetTime)) {
    return { status: 'insufficient', projectedLevel: null }
  }

  const xs = sorted.map((record) => (new Date(record.date).getTime() - firstTime) / DAY_MS)
  const ys = sorted.map((record) => record.level)

  if (xs.some((value) => Number.isNaN(value))) {
    return { status: 'insufficient', projectedLevel: null }
  }

  const count = xs.length
  const xMean = xs.reduce((sum, value) => sum + value, 0) / count
  const yMean = ys.reduce((sum, value) => sum + value, 0) / count

  let numerator = 0
  let denominator = 0

  for (let index = 0; index < count; index += 1) {
    const dx = xs[index] - xMean
    numerator += dx * (ys[index] - yMean)
    denominator += dx * dx
  }

  if (denominator === 0) {
    return { status: 'insufficient', projectedLevel: null }
  }

  const slope = numerator / denominator
  const intercept = yMean - slope * xMean
  const targetX = (targetTime - firstTime) / DAY_MS
  const projectedLevel = slope * targetX + intercept

  if (!Number.isFinite(projectedLevel)) {
    return { status: 'insufficient', projectedLevel: null }
  }

  const baseline = sorted[0].level
  const isIncreaseGoal = goal.targetLevel >= baseline
  const onTrack = isIncreaseGoal ? projectedLevel >= goal.targetLevel : projectedLevel <= goal.targetLevel

  return {
    status: onTrack ? 'on_track' : 'off_track',
    projectedLevel,
  }
}

const getXPositions = (
  records: GoalInput[],
  minX: number,
  maxX: number,
  spacingMode: ChartSpacingMode,
) => {
  if (records.length === 0) {
    return []
  }

  if (records.length === 1) {
    return [(minX + maxX) / 2]
  }

  if (spacingMode === 'equal') {
    return records.map((_, index) => minX + ((maxX - minX) * index) / (records.length - 1))
  }

  const times = records.map((record) => new Date(record.date).getTime())
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  if (minTime === maxTime) {
    return records.map((_, index) => minX + ((maxX - minX) * index) / (records.length - 1))
  }

  return times.map((time) => minX + ((maxX - minX) * (time - minTime)) / (maxTime - minTime))
}

type TrendLine = {
  x1: number
  y1: number
  x2: number
  y2: number
}

const getTrendLine = (
  xPositions: number[],
  levels: number[],
  toY: (value: number) => number,
): TrendLine | null => {
  if (xPositions.length < 2 || levels.length < 2 || xPositions.length !== levels.length) {
    return null
  }

  const count = xPositions.length
  const xMean = xPositions.reduce((sum, x) => sum + x, 0) / count
  const yMean = levels.reduce((sum, y) => sum + y, 0) / count

  let numerator = 0
  let denominator = 0

  for (let index = 0; index < count; index += 1) {
    const dx = xPositions[index] - xMean
    numerator += dx * (levels[index] - yMean)
    denominator += dx * dx
  }

  if (denominator === 0) {
    return null
  }

  const slope = numerator / denominator
  const intercept = yMean - slope * xMean

  const x1 = xPositions[0]
  const x2 = xPositions[count - 1]
  const y1 = toY(slope * x1 + intercept)
  const y2 = toY(slope * x2 + intercept)

  return { x1, y1, x2, y2 }
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', 'Bearer ' + token)
  }

  const response = await fetch(API_BASE + path, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let apiMessage: string | null = null
    try {
      const payload = (await response.json()) as { message?: unknown }
      if (typeof payload?.message === 'string') {
        apiMessage = payload.message
      }
    } catch {
      apiMessage = null
    }

    const error = new Error(apiMessage ?? 'API error: ' + response.status) as ApiRequestError
    error.status = response.status
    error.apiMessage = apiMessage
    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function copyToClipboardFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy failed')
  }
}

function MiniTrendChart({ records, targetLevel, spacingMode, emptyLabel, ariaLabel }: MiniTrendChartProps) {
  const sorted = getRecordsByDateAsc(records)

  if (sorted.length === 0) {
    return <div className="mini-chart-empty">{emptyLabel}</div>
  }

  const width = 170
  const height = 70
  const paddingX = 8
  const paddingY = 8
  const values = sorted.map((record) => record.level)
  values.push(targetLevel)

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const minY = min - range * 0.2
  const maxY = max + range * 0.2

  const xPositions = getXPositions(sorted, paddingX, width - paddingX, spacingMode)

  const toY = (value: number) => {
    const ratio = (value - minY) / (maxY - minY)
    return height - paddingY - ratio * (height - paddingY * 2)
  }

  const points = sorted.map((record, index) => {
    const x = xPositions[index]
    const y = toY(record.level)
    return { x, y }
  })

  const targetY = toY(targetLevel)
  const isDecreasing = sorted.length > 0 && sorted[0].level > targetLevel
  const path = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath = points.length > 1
    ? isDecreasing
      ? `M ${points[0].x} 0 ` + points.map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${points[points.length - 1].x} 0 Z`
      : `M ${points[0].x} ${height} ` + points.map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${points[points.length - 1].x} ${height} Z`
    : ''

  const trendLine = getTrendLine(
    xPositions,
    sorted.map((record) => record.level),
    toY,
  )

  return (
    <div className="mini-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`mini-area-gradient-${targetLevel}`} x1="0" y1={isDecreasing ? "1" : "0"} x2="0" y2={isDecreasing ? "0" : "1"}>
            <stop offset="0%" stopColor="var(--chart-record)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--chart-record)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={paddingX}
          y1={targetY}
          x2={width - paddingX}
          y2={targetY}
          stroke="var(--chart-target)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {areaPath ? <path d={areaPath} fill={`url(#mini-area-gradient-${targetLevel})`} /> : null}
        {trendLine ? (
          <line
            x1={trendLine.x1}
            y1={trendLine.y1}
            x2={trendLine.x2}
            y2={trendLine.y2}
            stroke="var(--chart-trend)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : null}
        {points.length > 1 ? <polyline fill="none" stroke="var(--chart-record)" strokeWidth="2" points={path} /> : null}
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="2.5" fill="var(--chart-record)" />
        ))}
      </svg>
    </div>
  )
}

function TrendChart({ records, targetLevel, unit, spacingMode, text }: TrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)
  const [pinnedPoint, setPinnedPoint] = useState<ChartPoint | null>(null)

  if (records.length === 0) {
    return <p className="empty">{text.noRecordsForChart}</p>
  }

  const width = 640
  const height = 240
  const paddingLeft = 54
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 34

  const values = records.map((record) => record.level)
  values.push(targetLevel)

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const range = rawMax - rawMin || 1
  const minY = rawMin - range * 0.15
  const maxY = rawMax + range * 0.15

  const graphWidth = width - paddingLeft - paddingRight
  const graphHeight = height - paddingTop - paddingBottom

  const xPositions = getXPositions(records, paddingLeft, paddingLeft + graphWidth, spacingMode)

  const toY = (value: number) => {
    const ratio = (value - minY) / (maxY - minY)
    return height - paddingBottom - ratio * graphHeight
  }

  const points: ChartPoint[] = records.map((record, index) => {
    const x = xPositions[index]
    const y = toY(record.level)
    return { ...record, x, y }
  })

  const isDecreasing = records.length > 0 && records[0].level > targetLevel

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath = points.length > 1
    ? isDecreasing
      ? `M ${points[0].x} ${paddingTop} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x} ${paddingTop} Z`
      : `M ${points[0].x} ${height - paddingBottom} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x} ${height - paddingBottom} Z`
    : ''

  const targetY = toY(targetLevel)
  const trendLine = getTrendLine(
    xPositions,
    records.map((record) => record.level),
    toY,
  )

  const yTicks = Array.from({ length: 5 }, (_, idx) => {
    const ratio = idx / 4
    const value = maxY - ratio * (maxY - minY)
    const y = paddingTop + ratio * graphHeight
    return { y, label: value.toFixed(1) }
  })

  const activePoint = pinnedPoint ?? hoveredPoint

  const tooltipLines = activePoint
    ? [
        `${text.tooltipDate}: ${activePoint.date}`,
        `${text.tooltipLevel}: ${activePoint.level} ${unit}`,
        ...(activePoint.message ? [`${text.tooltipMessage}: ${activePoint.message}`] : []),
      ]
    : []

  const tooltipWidth = 270
  const tooltipHeight = 14 + tooltipLines.length * 18

  const tooltipX = activePoint
    ? Math.min(Math.max(activePoint.x + 12, paddingLeft + 6), width - tooltipWidth - 6)
    : 0

  let tooltipY = activePoint ? activePoint.y - tooltipHeight - 10 : 0
  if (activePoint && tooltipY < paddingTop + 4) {
    tooltipY = Math.min(activePoint.y + 10, height - paddingBottom - tooltipHeight - 4)
  }

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart"
        role="img"
        aria-label={text.progressChartAria}
        onPointerDown={() => setPinnedPoint(null)}
      >
        <defs>
          <linearGradient id="chart-area-gradient" x1="0" y1={isDecreasing ? "1" : "0"} x2="0" y2={isDecreasing ? "0" : "1"}>
            <stop offset="0%" stopColor="var(--chart-record)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--chart-record)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} stroke="var(--chart-grid)" />
            <text x={8} y={tick.y + 4} fontSize="11" fill="var(--text-subtle)">
              {tick.label}
            </text>
          </g>
        ))}

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="var(--chart-axis)"
          strokeWidth="1.5"
        />
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="var(--chart-axis)"
          strokeWidth="1.5"
        />

        {areaPath ? <path d={areaPath} fill="url(#chart-area-gradient)" /> : null}

        <line
          x1={paddingLeft}
          y1={targetY}
          x2={width - paddingRight}
          y2={targetY}
          stroke="var(--chart-target)"
          strokeWidth="2"
          strokeDasharray="5 5"
        />

        {trendLine ? (
          <line
            x1={trendLine.x1}
            y1={trendLine.y1}
            x2={trendLine.x2}
            y2={trendLine.y2}
            stroke="var(--chart-trend)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        ) : null}
        {points.length > 1 ? <polyline fill="none" stroke="var(--chart-record)" strokeWidth="3" points={polyline} /> : null}

        {points.map((point) => (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r="18"
              fill="transparent"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onPointerDown={(event) => {
                event.stopPropagation()
                setPinnedPoint((prev) => (prev?.id === point.id ? null : point))
              }}
            />
            <circle cx={point.x} cy={point.y} r="5" fill="var(--chart-record)" pointerEvents="none" />
            <line
              x1={point.x}
              y1={height - paddingBottom}
              x2={point.x}
              y2={height - paddingBottom + 5}
              stroke="var(--chart-axis)"
            />
          </g>
        ))}

        {points.map((point) => (
          <text key={`label-${point.id}`} x={point.x} y={height - 8} fontSize="10" textAnchor="middle" fill="var(--text-subtle)">
            {point.date.slice(5)}
          </text>
        ))}

        {activePoint ? (
          <g pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="8"
              fill="var(--text-primary)"
              fillOpacity="0.92"
              stroke="var(--text-strong)"
            />
            {tooltipLines.map((line, index) => (
              <text
                key={`${activePoint.id}-${index}`}
                x={tooltipX + 10}
                y={tooltipY + 22 + index * 18}
                fontSize="12"
                fill="var(--surface)"
              >
                {line}
              </text>
            ))}
          </g>
        ) : null}
      </svg>

      <div className="chart-legend">
        <span>{text.legendRecords}</span>
        <span>{text.legendTarget}</span>
        <span>{text.legendTrend}</span>
      </div>
    </div>
  )
}

const PROFILE_BADGE_PALETTE = [
  { bg: '#175cd3', border: '#0f4db8' },
  { bg: '#0e9384', border: '#0b7a6d' },
  { bg: '#b54708', border: '#93370d' },
  { bg: '#8e4ec6', border: '#7a3eb4' },
  { bg: '#c4325f', border: '#a3264c' },
  { bg: '#2d6a4f', border: '#245642' },
  { bg: '#5b4db2', border: '#4a3f97' },
  { bg: '#0b7fab', border: '#0a678b' },
]

const getProfileColorIndex = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return 0
  }

  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }

  return hash % PROFILE_BADGE_PALETTE.length
}
function App({ profileName, onLogout }: { profileName: string; onLogout: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)

  const [inputGoalId, setInputGoalId] = useState<number | null>(null)
  const [editingInputId, setEditingInputId] = useState<number | null>(null)

  const [recordGoalId, setRecordGoalId] = useState<number | null>(null)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [isSavingGoalOrder, setIsSavingGoalOrder] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chartSpacingMode, setChartSpacingMode] = useState<ChartSpacingMode>('equal')
  const [language, setLanguage] = useState<Language>('ko')
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [chatbotKeyPrefix, setChatbotKeyPrefix] = useState<string | null>(null)
  const [chatbotKeyIssuedAt, setChatbotKeyIssuedAt] = useState<string | null>(null)
  const [newChatbotApiKey, setNewChatbotApiKey] = useState<string | null>(null)
  const [isIssuingChatbotKey, setIsIssuingChatbotKey] = useState(false)
  const [isRevokingChatbotKey, setIsRevokingChatbotKey] = useState(false)
  const [chatbotKeyNotice, setChatbotKeyNotice] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const goalOrderSnapshotRef = useRef<number[] | null>(null)

  const text = TEXT[language]
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || '?'
  const profileBadgeStyle = useMemo(() => {
    const colorIndex = getProfileColorIndex(profileName)
    const paletteItem = PROFILE_BADGE_PALETTE[colorIndex]
    return {
      '--profile-bg': paletteItem.bg,
      '--profile-border': paletteItem.border,
    } as CSSProperties
  }, [profileName])

  const [goalForm, setGoalForm] = useState<GoalFormState>({
    name: '',
    targetDate: getToday(),
    targetLevel: '',
    unit: '',
  })

  const [inputForm, setInputForm] = useState<InputFormState>({
    date: getToday(),
    level: '',
    message: '',
  })

  const inputTargetGoal = useMemo(
    () => goals.find((goal) => goal.id === inputGoalId) ?? null,
    [goals, inputGoalId],
  )

  const adInsertIndexes = useMemo(() => getGoalAdInsertIndexes(goals), [goals])




  const loadGoals = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const result = await requestApi<Goal[]>('/goals')
      setGoals(result)
    } catch {
      setErrorMessage(TEXT[language].errors.loadData)
    } finally {
      setIsLoading(false)
    }
  }, [language])

  const loadSettings = useCallback(async () => {
    try {
      const result = await requestApi<SettingsResponse>('/settings')
      if (result.chartSpacingMode === 'equal' || result.chartSpacingMode === 'actual') {
        setChartSpacingMode(result.chartSpacingMode)
      }
      if (result.language === 'ko' || result.language === 'en') {
        setLanguage(result.language)
      }
      setThemeId(normalizeThemeId(result.themeId))
    } catch {
      setErrorMessage(TEXT[language].errors.loadSettings)
    }
  }, [language])

  const loadChatbotApiKeyStatus = useCallback(async () => {
    try {
      const result = await requestApi<ChatbotApiKeyStatusResponse>('/chatbot/api-key')
      setChatbotKeyPrefix(result.hasKey ? result.keyPrefix : null)
      setChatbotKeyIssuedAt(result.hasKey ? result.issuedAt : null)
      setNewChatbotApiKey(result.hasKey ? result.apiKey : null)
    } catch {
      setErrorMessage(TEXT[language].errors.loadSettings)
    }
  }, [language])

  const updateChartSpacingMode = async (mode: ChartSpacingMode) => {
    setChartSpacingMode(mode)
    try {
      await requestApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ chartSpacingMode: mode }),
      })
    } catch {
      setErrorMessage(TEXT[language].errors.saveSettings)
    }
  }

  const updateLanguage = async (nextLanguage: Language) => {
    try {
      await requestApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ language: nextLanguage }),
      })
      setLanguage(nextLanguage)
    } catch {
      setErrorMessage(TEXT[nextLanguage].errors.saveSettings)
    }
  }

  const updateTheme = async (nextThemeId: string) => {
    const normalizedThemeId = normalizeThemeId(nextThemeId)
    setThemeId(normalizedThemeId)

    try {
      await requestApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ themeId: normalizedThemeId }),
      })
    } catch {
      setErrorMessage(TEXT[language].errors.saveSettings)
    }
  }

  const issueChatbotApiKey = async () => {
    setIsIssuingChatbotKey(true)
    try {
      const result = await requestApi<ChatbotApiKeyIssueResponse>('/chatbot/api-key/issue', {
        method: 'POST',
      })
      setNewChatbotApiKey(result.apiKey)
      setChatbotKeyPrefix(result.keyPrefix)
      setChatbotKeyIssuedAt(result.issuedAt)
    } catch {
      setErrorMessage(text.errors.saveSettings)
    } finally {
      setIsIssuingChatbotKey(false)
    }
  }

  const revokeChatbotApiKey = async () => {
    setIsRevokingChatbotKey(true)
    try {
      await requestApi('/chatbot/api-key', {
        method: 'DELETE',
      })
      setNewChatbotApiKey(null)
      setChatbotKeyPrefix(null)
      setChatbotKeyIssuedAt(null)
    } catch {
      setErrorMessage(text.errors.saveSettings)
    } finally {
      setIsRevokingChatbotKey(false)
    }
  }

  const copyChatbotApiKey = async () => {
    try {
      let keyToCopy = newChatbotApiKey

      if (!keyToCopy && chatbotKeyPrefix) {
        const result = await requestApi<ChatbotApiKeyIssueResponse>('/chatbot/api-key/issue', {
          method: 'POST',
        })
        keyToCopy = result.apiKey
        setNewChatbotApiKey(result.apiKey)
        setChatbotKeyPrefix(result.keyPrefix)
        setChatbotKeyIssuedAt(result.issuedAt)
      }

      if (!keyToCopy) {
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(keyToCopy)
      } else {
        copyToClipboardFallback(keyToCopy)
      }
      setChatbotKeyNotice(text.chatbotApiKeyCopied)
    } catch {
      setErrorMessage(text.errors.saveSettings)
    }
  }

  useEffect(() => {
    void Promise.all([loadGoals(), loadSettings(), loadChatbotApiKeyStatus()])
  }, [loadGoals, loadSettings, loadChatbotApiKeyStatus])

  useEffect(() => {
    document.title = text.appTitle
  }, [text.appTitle])

  useEffect(() => {
    applyThemeById(themeId)
  }, [themeId])


  const scrollGoalIntoView = (goalId: number) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`goal-${goalId}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const scrollRecordIntoView = (recordId: number) => {
    const scroll = () => {
      const target = document.getElementById(`record-${recordId}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    scroll()
    window.requestAnimationFrame(scroll)
  }
  const scrollGoalCreateFormIntoView = () => {
    const scroll = () => {
      const target = document.getElementById('goal-create-form')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    window.requestAnimationFrame(() => {
      scroll()
      window.requestAnimationFrame(scroll)
    })
  }

  const keepCurrentScrollPosition = () => {
    const left = window.scrollX
    const top = window.scrollY

    window.requestAnimationFrame(() => {
      window.scrollTo({ left, top, behavior: 'auto' })
      window.requestAnimationFrame(() => {
        window.scrollTo({ left, top, behavior: 'auto' })
      })
    })
  }

  useEffect(() => {
    if (goalFormOpen && editingGoalId === null) {
      scrollGoalCreateFormIntoView()
    }
  }, [goalFormOpen, editingGoalId])

  const openCreateGoalForm = () => {
    if (goalFormOpen && editingGoalId === null) {
      keepCurrentScrollPosition()
      closeGoalForm()
      return
    }

    setEditingGoalId(null)
    setGoalForm({
      name: '',
      targetDate: getToday(),
      targetLevel: '',
      unit: '',
    })
    setGoalFormOpen(true)
  }

  const openEditGoalForm = (goal: Goal) => {
    if (editingGoalId === goal.id) {
      keepCurrentScrollPosition()
      closeGoalForm()
      return
    }

    closeInputForm()
    setRecordGoalId(null)
    scrollGoalIntoView(goal.id)
    setEditingGoalId(goal.id)
    setGoalForm({
      name: goal.name,
      targetDate: goal.targetDate,
      targetLevel: String(goal.targetLevel),
      unit: goal.unit,
    })
    setGoalFormOpen(false)
  }

  const closeGoalForm = () => {
    setGoalFormOpen(false)
    setEditingGoalId(null)
  }

  const handleGoalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const targetLevel = Number(goalForm.targetLevel)
    if (!goalForm.name.trim() || !goalForm.targetDate || !goalForm.unit.trim() || Number.isNaN(targetLevel)) {
      return
    }

    try {
      if (editingGoalId === null) {
        await requestApi('/goals', {
          method: 'POST',
          body: JSON.stringify({
            name: goalForm.name.trim(),
            targetDate: goalForm.targetDate,
            targetLevel,
            unit: goalForm.unit.trim(),
          }),
        })
      } else {
        await requestApi(`/goals/${editingGoalId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: goalForm.name.trim(),
            targetDate: goalForm.targetDate,
            targetLevel,
            unit: goalForm.unit.trim(),
          }),
        })
      }

      closeGoalForm()
      await loadGoals()
    } catch (error) {
      const apiError = error as Partial<ApiRequestError>
      if (apiError.status === 409 && apiError.apiMessage === GOAL_LIMIT_API_MESSAGE) {
        setErrorMessage(text.errors.goalLimit)
        return
      }
      setErrorMessage(text.errors.saveGoal)
    }
  }

  const handleDeleteGoal = async () => {
    if (editingGoalId === null) {
      return
    }

    if (!window.confirm(text.confirmDeleteGoal)) {
      return
    }

    try {
      await requestApi(`/goals/${editingGoalId}`, { method: 'DELETE' })
      closeGoalForm()
      await loadGoals()
    } catch {
      setErrorMessage(text.errors.deleteGoal)
    }
  }

  const openInputForm = (goal: Goal) => {
    if (inputGoalId === goal.id && editingInputId === null) {
      keepCurrentScrollPosition()
      closeInputForm()
      return
    }

    closeGoalForm()
    setRecordGoalId(null)
    scrollGoalIntoView(goal.id)
    setInputGoalId(goal.id)
    setEditingInputId(null)
    setInputForm({
      date: getToday(),
      level: '',
      message: '',
    })
  }

  const openInputEditForm = (goalId: number, record: GoalInput) => {
    if (inputGoalId === goalId && editingInputId === record.id) {
      keepCurrentScrollPosition()
      closeInputForm()
      return
    }

    scrollRecordIntoView(record.id)
    setInputGoalId(goalId)
    setEditingInputId(record.id)
    setInputForm({
      date: record.date,
      level: String(record.level),
      message: record.message ?? '',
    })
  }

  const closeInputForm = () => {
    setInputGoalId(null)
    setEditingInputId(null)
    setInputForm({ date: getToday(), level: '', message: '' })
  }

  const handleInputSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!inputTargetGoal) {
      return
    }

    const level = Number(inputForm.level)
    if (!inputForm.date || Number.isNaN(level)) {
      return
    }

    try {
      if (editingInputId === null) {
        await requestApi(`/goals/${inputTargetGoal.id}/records`, {
          method: 'POST',
          body: JSON.stringify({
            date: inputForm.date,
            level,
            message: inputForm.message,
          }),
        })
      } else {
        await requestApi(`/goals/${inputTargetGoal.id}/records/${editingInputId}`, {
          method: 'PUT',
          body: JSON.stringify({
            date: inputForm.date,
            level,
            message: inputForm.message,
          }),
        })
      }

      closeInputForm()
      await loadGoals()
    } catch (error) {
      const apiError = error as Partial<ApiRequestError>
      if (apiError.status === 409 && apiError.apiMessage === RECORD_LIMIT_API_MESSAGE) {
        setErrorMessage(text.errors.recordLimit)
        return
      }
      setErrorMessage(text.errors.saveRecord)
    }
  }

  const handleDeleteRecord = async (goalId: number, recordId: number) => {
    if (!window.confirm(text.confirmDeleteRecord)) {
      return
    }

    try {
      await requestApi(`/goals/${goalId}/records/${recordId}`, { method: 'DELETE' })
      await loadGoals()
    } catch {
      setErrorMessage(text.errors.deleteRecord)
    }
  }

  const saveGoalOrder = async (orderedGoalIds: number[]) => {
    await requestApi('/goals/order', {
      method: 'PUT',
      body: JSON.stringify({ goalIds: orderedGoalIds }),
    })
  }

  const moveGoalInList = (goalId: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setGoals((currentGoals) => {
      const currentIndex = currentGoals.findIndex((goal) => goal.id === goalId)
      if (currentIndex < 0) {
        return currentGoals
      }

      const targetIndex = direction === 'top'
        ? 0
        : direction === 'bottom'
          ? currentGoals.length - 1
          : direction === 'up'
            ? currentIndex - 1
            : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= currentGoals.length) {
        return currentGoals
      }

      const nextGoals = [...currentGoals]
      const [movedGoal] = nextGoals.splice(currentIndex, 1)
      nextGoals.splice(targetIndex, 0, movedGoal)
      return nextGoals
    })
  }

  const startReorderMode = () => {
    closeGoalForm()
    closeInputForm()
    setRecordGoalId(null)
    setSettingsOpen(false)
    setProfileMenuOpen(false)
    goalOrderSnapshotRef.current = goals.map((goal) => goal.id)
    setIsReorderMode(true)
  }

  const cancelReorderMode = () => {
    const snapshot = goalOrderSnapshotRef.current
    if (snapshot) {
      setGoals((currentGoals) => snapshot
        .map((goalId) => currentGoals.find((goal) => goal.id === goalId) ?? null)
        .filter((goal): goal is Goal => goal !== null))
    }
    setIsReorderMode(false)
    goalOrderSnapshotRef.current = null
  }

  const finishReorderMode = async () => {
    setIsSavingGoalOrder(true)
    try {
      await saveGoalOrder(goals.map((goal) => goal.id))
      setIsReorderMode(false)
      goalOrderSnapshotRef.current = null
    } catch (error) {
      const apiError = error as Partial<ApiRequestError>
      const detail = apiError.apiMessage ?? (typeof apiError.status === 'number' ? `HTTP ${apiError.status}` : null)
      setErrorMessage(detail ? `${text.errors.saveGoalOrder} (${detail})` : text.errors.saveGoalOrder)
      await loadGoals()
    } finally {
      setIsSavingGoalOrder(false)
    }
  }

  const openRecordView = (goalId: number) => {
    const isClosing = recordGoalId === goalId

    closeGoalForm()
    closeInputForm()

    if (isClosing) {
      keepCurrentScrollPosition()
      setRecordGoalId(null)
      return
    }

    scrollGoalIntoView(goalId)
    setRecordGoalId(goalId)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>{text.appTitle}</h1>
        <div className="header-actions">
          {isReorderMode ? (
            <>
              <button type="button" onClick={cancelReorderMode} disabled={isSavingGoalOrder}>
                {text.cancel}
              </button>
              <button type="button" className="primary" onClick={() => void finishReorderMode()} disabled={isSavingGoalOrder}>
                {text.finishReorder}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="primary" onClick={openCreateGoalForm}>
                {text.addGoal}
              </button>
              <button type="button" onClick={startReorderMode}>
                {text.reorderGoals}
              </button>
            </>
          )}
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-trigger"
              style={profileBadgeStyle}
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label={profileName}
              title={profileName}
            >
              {profileInitial}
            </button>
            {profileMenuOpen ? (
              <div className="profile-dropdown" role="menu">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    window.open(`${window.location.origin}/#/chatbot-guide`, '_blank', 'noopener,noreferrer')
                  }}
                >
                  {text.chatbotGuide}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    window.open(`${window.location.origin}/#/mcp-guide`, '_blank', 'noopener,noreferrer')
                  }}
                >
                  {text.mcpGuide}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen((prev) => !prev)
                    setProfileMenuOpen(false)
                  }}
                >
                  {text.settings}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    onLogout()
                  }}
                >
                  {text.logout}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {settingsOpen ? (
        <section className="panel settings-panel" aria-label="settings-panel">
          <div className="settings-panel-header">
            <h2>{text.settings}</h2>
            <button type="button" onClick={() => setSettingsOpen(false)}>{text.close}</button>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{text.chartSpacingLabel}</span>
            <label className="settings-option">
              <input
                type="radio"
                name="spacingMode"
                checked={chartSpacingMode === 'equal'}
                onChange={() => void updateChartSpacingMode('equal')}
              />
              {text.equalSpacing}
            </label>
            <label className="settings-option">
              <input
                type="radio"
                name="spacingMode"
                checked={chartSpacingMode === 'actual'}
                onChange={() => void updateChartSpacingMode('actual')}
              />
              {text.actualSpacing}
            </label>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{text.languageLabel}</span>
            <label className="settings-option">
              <input
                type="radio"
                name="language"
                checked={language === 'ko'}
                onChange={() => void updateLanguage('ko')}
              />
              한국어
            </label>
            <label className="settings-option">
              <input
                type="radio"
                name="language"
                checked={language === 'en'}
                onChange={() => void updateLanguage('en')}
              />
              English
            </label>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{text.themeLabel}</span>
            {THEMES.map((theme) => (
              <label key={theme.id} className="settings-option">
                <input
                  type="radio"
                  name="theme"
                  checked={themeId === theme.id}
                  onChange={() => void updateTheme(theme.id)}
                />
                {language === 'ko' ? theme.label.ko : theme.label.en}
              </label>
            ))}
          </div>
          <div className="chatbot-key-panel">
            <h3>{text.chatbotApiKeyTitle}</h3>
            <p className="empty">{text.chatbotApiKeyDesc}</p>
            <p className="chatbot-key-meta"><span>{text.chatbotApiKeyActivePrefix}</span><strong>{chatbotKeyPrefix ?? text.chatbotApiKeyMissing}</strong></p>
            <p className="chatbot-key-meta"><span>{text.chatbotApiKeyIssuedAt}</span><strong>{chatbotKeyIssuedAt ?? '-'}</strong></p>
            <div className="actions">
              <button type="button" className="primary" onClick={() => void issueChatbotApiKey()} disabled={isIssuingChatbotKey}>
                {text.chatbotApiKeyIssue}
              </button>
              <button type="button" onClick={() => void copyChatbotApiKey()} disabled={!newChatbotApiKey && !chatbotKeyPrefix}>
                {text.chatbotApiKeyCopy}
              </button>
              <button type="button" className="danger" onClick={() => void revokeChatbotApiKey()} disabled={isRevokingChatbotKey || !chatbotKeyPrefix}>
                {text.chatbotApiKeyRevoke}
              </button>
            </div>
            {newChatbotApiKey ? (
              <>
                <p className="error-text">{text.chatbotApiKeyShownOnce}</p>
                <pre className="guide-code">{newChatbotApiKey}</pre>
              </>
            ) : null}
            {!newChatbotApiKey && chatbotKeyPrefix ? (
              <p className="empty">{text.chatbotApiKeyLegacyNotice}</p>
            ) : null}
            {chatbotKeyNotice ? <p className="empty">{chatbotKeyNotice}</p> : null}
          </div>
        </section>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {isLoading ? <p className="empty">{text.loading}</p> : null}

      {goalFormOpen && (
        <section id="goal-create-form" className="panel" aria-label="goal-form">
          <h2>{text.goalCreate}</h2>
          <form className="form-grid" onSubmit={handleGoalSubmit}>
            <label>
              {text.name}
              <input
                value={goalForm.name}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={text.namePlaceholder}
                required
              />
            </label>

            <label>
              {text.targetDate}
              <input
                type="date"
                value={goalForm.targetDate}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                required
              />
            </label>

            <label>
              {text.targetLevel}
              <input
                type="number"
                step="any"
                value={goalForm.targetLevel}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, targetLevel: event.target.value }))}
                placeholder={text.targetLevelPlaceholder}
                required
              />
            </label>

            <label>
              {text.unit}
              <input
                value={goalForm.unit}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, unit: event.target.value }))}
                placeholder={text.unitPlaceholder}
                required
              />
            </label>

            <div className="actions">
              <button type="submit" className="primary">
                {text.save}
              </button>
              <button type="button" onClick={closeGoalForm}>
                {text.cancel}
              </button>

            </div>
          </form>
        </section>
      )}

      <section className="list-wrap">
        <h2>{text.goalList}</h2>

        {goals.length === 0 ? (
          <p className="empty">{text.noGoalsYet}</p>
        ) : (
          <ul className="goal-list">
            {goals.map((goal, index) => {
              const latestInput = getLatestRecord(goal.inputs)
              const trendAssessment = getGoalTrendAssessment(goal)

              return (
                <Fragment key={goal.id}>
                  <li
                  id={`goal-${goal.id}`}
                  key={goal.id}
                  data-goal-id={goal.id}
                  className={`goal-item${trendAssessment.status === 'on_track' ? ' goal-item-on-track' : ''}${trendAssessment.status === 'off_track' ? ' goal-item-off-track' : ''}`}
                >
                  <div className="goal-top">
                    <div className="goal-meta">
                      <div className="goal-title-row">
                        <strong className="goal-name">{goal.name}</strong>
                        {isReorderMode ? <span className="goal-order-badge">#{index + 1}</span> : null}
                        {trendAssessment.status !== 'insufficient' ? (
                          <span
                            className={`goal-trend-badge ${trendAssessment.status === "on_track" ? "on-track" : "off-track"}`}
                            title={`${text.goalTrendProjected}: ${trendAssessment.projectedLevel?.toFixed(1)} ${goal.unit} / ${goal.targetLevel} ${goal.unit}`}
                          >
                            {trendAssessment.status === 'on_track' ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                <polyline points="17 6 23 6 23 12"></polyline>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                                <polyline points="17 18 23 18 23 12"></polyline>
                              </svg>
                            )}
                            {(trendAssessment.status === 'on_track' ? text.goalTrendOnTrack : text.goalTrendOffTrack) +
                              ` | ${text.goalTrendProjected} ${trendAssessment.projectedLevel?.toFixed(1)} ${goal.unit}`}
                          </span>
                        ) : null}
                      </div>

                      <div className="goal-summary">
                        <p className="goal-summary-line">
                          <span className="goal-summary-label">{text.goalPrefix}</span>
                          <span className="goal-summary-value">{goal.targetLevel} {goal.unit} ({goal.targetDate})</span>
                        </p>
                        <p className="goal-summary-line">
                          <span className="goal-summary-label">{text.latestInput}</span>
                          <span className="goal-summary-value">
                            {latestInput
                              ? latestInput.level + ' ' + goal.unit + ' (' + latestInput.date + ')'
                              : text.none}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        className="mini-chart-trigger"
                        onClick={() => openRecordView(goal.id)}
                        aria-label={`${goal.name} ${text.viewRecords}`}
                        title={text.viewRecords}
                      >
                        <MiniTrendChart
                          records={goal.inputs}
                          targetLevel={goal.targetLevel}
                          spacingMode={chartSpacingMode}
                          emptyLabel={text.miniNoRecords}
                          ariaLabel={text.miniProgressChartAria}
                        />
                      </button>
                    </div>

                    <div className={`goal-actions${isReorderMode ? ' goal-actions-reorder' : ''}`}>
                      {isReorderMode ? (
                        <>
                          <button type="button" className="goal-order-button" onClick={() => moveGoalInList(goal.id, 'top')} disabled={index === 0 || isSavingGoalOrder} aria-label={text.moveTop} title={text.moveTop}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="4 6.5 8 2.5 12 6.5" />
                              <polyline points="4 12.5 8 8.5 12 12.5" />
                            </svg>
                          </button>
                          <button type="button" className="goal-order-button" onClick={() => moveGoalInList(goal.id, 'up')} disabled={index === 0 || isSavingGoalOrder} aria-label={text.moveUp} title={text.moveUp}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="4 10.5 8 6.5 12 10.5" />
                            </svg>
                          </button>
                          <button type="button" className="goal-order-button" onClick={() => moveGoalInList(goal.id, 'down')} disabled={index === goals.length - 1 || isSavingGoalOrder} aria-label={text.moveDown} title={text.moveDown}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="4 6.5 8 10.5 12 6.5" />
                            </svg>
                          </button>
                          <button type="button" className="goal-order-button" onClick={() => moveGoalInList(goal.id, 'bottom')} disabled={index === goals.length - 1 || isSavingGoalOrder} aria-label={text.moveBottom} title={text.moveBottom}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="4 3.5 8 7.5 12 3.5" />
                              <polyline points="4 9.5 8 13.5 12 9.5" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="primary goal-action-button goal-action-input" onClick={() => openInputForm(goal)}>
                            {text.enterStatus}
                          </button>
                          <button type="button" className="goal-action-button goal-action-records" onClick={() => openRecordView(goal.id)}>
                            {text.viewRecords}
                          </button>
                          <button type="button" className="goal-action-button goal-action-edit" onClick={() => openEditGoalForm(goal)}>
                            {text.edit}
                          </button>
                        </>
                      )}
                    </div>                  </div>

                  {editingGoalId === goal.id ? (
                    <section className="panel goal-detail-panel goal-edit-inline" aria-label="goal-edit-inline">
                      <h2>{goal.name} - {text.goalEdit}</h2>
                      <form className="form-grid" onSubmit={handleGoalSubmit}>
                        <label>
                          {text.name}
                          <input
                            value={goalForm.name}
                            onChange={(event) => setGoalForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder={text.namePlaceholder}
                            required
                          />
                        </label>

                        <label>
                          {text.targetDate}
                          <input
                            type="date"
                            value={goalForm.targetDate}
                            onChange={(event) => setGoalForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                            required
                          />
                        </label>

                        <label>
                          {text.targetLevel}
                          <input
                            type="number"
                            step="any"
                            value={goalForm.targetLevel}
                            onChange={(event) => setGoalForm((prev) => ({ ...prev, targetLevel: event.target.value }))}
                            placeholder={text.targetLevelPlaceholder}
                            required
                          />
                        </label>

                        <label>
                          {text.unit}
                          <input
                            value={goalForm.unit}
                            onChange={(event) => setGoalForm((prev) => ({ ...prev, unit: event.target.value }))}
                            placeholder={text.unitPlaceholder}
                            required
                          />
                        </label>

                        <div className="actions">
                          <button type="submit" className="primary">
                            {text.save}
                          </button>
                          <button type="button" onClick={closeGoalForm}>
                            {text.cancel}
                          </button>
                          <button type="button" className="danger" onClick={() => void handleDeleteGoal()}>
                            {text.delete}
                          </button>
                        </div>
                      </form>
                    </section>
                  ) : null}

                  {inputGoalId === goal.id && editingInputId === null ? (
                    <section className="panel goal-detail-panel" aria-label="input-form">
                      <h2>
                        {goal.name} - {editingInputId === null ? text.statusInput : text.recordEdit}
                      </h2>
                      <form className="form-grid" onSubmit={handleInputSubmit}>
                        <label>
                          {text.date}
                          <input
                            type="date"
                            value={inputForm.date}
                            onChange={(event) => setInputForm((prev) => ({ ...prev, date: event.target.value }))}
                            required
                          />
                        </label>

                        <label>
                          {text.currentLevel} ({goal.unit})
                          <input
                            type="number"
                            step="any"
                            value={inputForm.level}
                            onChange={(event) => setInputForm((prev) => ({ ...prev, level: event.target.value }))}
                            placeholder={`e.g. 3 (${goal.unit})`}
                            required
                          />
                        </label>

                        <label className="full-width">
                          {text.messageOptional}
                          <textarea
                            rows={3}
                            value={inputForm.message}
                            onChange={(event) => setInputForm((prev) => ({ ...prev, message: event.target.value }))}
                            placeholder={text.messagePlaceholder}
                          />
                        </label>

                        <div className="actions">
                          <button type="submit" className="primary">
                            {editingInputId === null ? text.saveInput : text.saveEdit}
                          </button>
                          <button type="button" onClick={closeInputForm}>
                            {text.cancel}
                          </button>
                        </div>
                      </form>
                    </section>
                  ) : null}

                  {recordGoalId === goal.id ? (
                    <section className="panel goal-detail-panel" aria-label="record-view">
                      <div className="record-header">
                        <h2>{goal.name} - {text.recordView}</h2>
                        <button type="button" onClick={() => setRecordGoalId(null)}>
                          {text.close}
                        </button>
                      </div>

                      <TrendChart
                        records={getRecordsByDateAsc(goal.inputs)}
                        targetLevel={goal.targetLevel}
                        unit={goal.unit}
                        spacingMode={chartSpacingMode}
                        text={text}
                      />

                      <div className="record-list-wrap">
                        <h3>{text.recordList}</h3>
                        {goal.inputs.length === 0 ? (
                          <p className="empty">{text.noRecords}</p>
                        ) : (
                          <ul className="record-list">
                            {[...getRecordsByDateAsc(goal.inputs)].reverse().map((record) => (
                              <Fragment key={record.id}>
                                <li id={`record-${record.id}`} className="record-item">
                                  <div className="record-text">
                                    <span>
                                      {record.date} - {record.level} {goal.unit}
                                    </span>
                                    {record.message ? <span className="record-message">{record.message}</span> : null}
                                  </div>
                                  <div className="record-actions">
                                    <button type="button" className="record-action-button" onClick={() => openInputEditForm(goal.id, record)}>
                                      {text.edit}
                                    </button>
                                    <button type="button" className="record-action-button danger" onClick={() => void handleDeleteRecord(goal.id, record.id)}>
                                      {text.delete}
                                    </button>
                                  </div>
                                </li>

                                {inputGoalId === goal.id && editingInputId === record.id ? (
                                  <li className="record-edit-inline">
                                    <form className="form-grid" onSubmit={handleInputSubmit}>
                                      <label>
                                        {text.date}
                                        <input
                                          type="date"
                                          value={inputForm.date}
                                          onChange={(event) => setInputForm((prev) => ({ ...prev, date: event.target.value }))}
                                          required
                                        />
                                      </label>

                                      <label>
                                        {text.currentLevel} ({goal.unit})
                                        <input
                                          type="number"
                                          step="any"
                                          value={inputForm.level}
                                          onChange={(event) => setInputForm((prev) => ({ ...prev, level: event.target.value }))}
                                          placeholder={`e.g. 3 (${goal.unit})`}
                                          required
                                        />
                                      </label>

                                      <label className="full-width">
                                        {text.messageOptional}
                                        <textarea
                                          rows={3}
                                          value={inputForm.message}
                                          onChange={(event) => setInputForm((prev) => ({ ...prev, message: event.target.value }))}
                                          placeholder={text.messagePlaceholder}
                                        />
                                      </label>

                                      <div className="actions">
                                        <button type="submit" className="primary">
                                          {text.saveEdit}
                                        </button>
                                        <button type="button" onClick={closeInputForm}>
                                          {text.cancel}
                                        </button>
                                      </div>
                                    </form>
                                  </li>
                                ) : null}
                              </Fragment>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  ) : null}
                </li>
                  {adInsertIndexes.has(index) ? <GoalListAdCard /> : null}
                </Fragment>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
















