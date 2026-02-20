import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type GoalInput = {
  id: number
  date: string
  level: number
  message?: string
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

const TEXT = {
  ko: {
    appTitle: '작심사일',
    settings: '설정',
    chatbotGuide: '\uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
    addGoal: '목표 추가',
    chartSpacingLabel: '그래프 X축 간격',
    equalSpacing: '등간격',
    actualSpacing: '실제간격',
    languageLabel: '언어',
    korean: '한국어',
    english: '영어',
    logout: '로그아웃',
    chatbotApiKeyTitle: '\uCC57\uBD07 API \uD0A4',
    chatbotApiKeyDesc: '\uC678\uBD80 \uCC57\uBD07\uC5D0\uC11C \uC0C1\uD0DC \uC785\uB825 \uC2DC \uC0AC\uC6A9\uD560 \uC0AC\uC6A9\uC790 \uC804\uC6A9 \uD0A4\uC785\uB2C8\uB2E4.',
    chatbotApiKeyIssue: '\uD0A4 \uBC1C\uAE09/\uC7AC\uBC1C\uAE09',
    chatbotApiKeyCopy: '\uD0A4 \uBCF5\uC0AC',
    chatbotApiKeyRevoke: '\uD0A4 \uD3D0\uAE30',
    chatbotApiKeyMissing: '\uBC1C\uAE09\uB41C \uD0A4 \uC5C6\uC74C',
    chatbotApiKeyActivePrefix: '\uD604\uC7AC \uD0A4 Prefix',
    chatbotApiKeyIssuedAt: '\uBC1C\uAE09 \uC2DC\uAC01',
    chatbotApiKeyShownOnce: '\uC544\uB798 \uD0A4\uB294 \uC9C0\uAE08 \uD55C \uBC88\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4. \uC548\uC804\uD55C \uACF3\uC5D0 \uC800\uC7A5\uD558\uC138\uC694.',
    chatbotApiKeyLegacyNotice: '\uAE30\uC874 \uD0A4\uB294 \uBCF5\uAD6C\uAC00 \uBD88\uAC00\ud569\ub2c8\ub2e4. \uBCF5\uC0AC \uBC84\ud2bc\uc744 \ub204\ub974\uba74 \uc790\ub3d9 \uc7ac\ubc1c\uae09\ub429\ub2c8\ub2e4.',
    chatbotApiKeyCopied: '\uD0A4\uAC00 \uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
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
    statusInput: '상태 입력',
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
    none: '없음',
    enterStatus: '상태입력',
    viewRecords: '기록 보기',
    edit: '수정',
    noRecordsForChart: '기록이 없어 그래프를 표시할 수 없습니다.',
    miniNoRecords: '기록 없음',
    legendRecords: '파란선: 기록',
    legendTarget: '빨간 점선: 목표수준',
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
      deleteGoal: '목표 삭제에 실패했습니다.',
      saveRecord: '기록 저장에 실패했습니다.',
      deleteRecord: '기록 삭제에 실패했습니다.',
    },
  },
  en: {
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
    addGoal: 'Add Goal',
    chartSpacingLabel: 'Chart X-Axis Spacing',
    equalSpacing: 'Equal Spacing',
    actualSpacing: 'Actual Spacing',
    languageLabel: 'Language',
    korean: 'Korean',
    english: 'English',
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
    none: 'None',
    enterStatus: 'Enter Status',
    viewRecords: 'View Records',
    edit: 'Edit',
    noRecordsForChart: 'No records available to render this chart.',
    miniNoRecords: 'No records',
    legendRecords: 'Blue line: records',
    legendTarget: 'Red dashed line: target level',
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
      deleteGoal: 'Failed to delete goal.',
      saveRecord: 'Failed to save record.',
      deleteRecord: 'Failed to delete record.',
    },
  },
} as const

const AUTH_TOKEN_KEY = 'day4_auth_token'
const getToday = () => new Date().toISOString().slice(0, 10)

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:8787/api`

const getRecordsByDateAsc = (records: GoalInput[]) =>
  [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

const getLatestRecord = (records: GoalInput[]) =>
  [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

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

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
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
  const path = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="mini-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" aria-label={ariaLabel}>
        <line
          x1={paddingX}
          y1={targetY}
          x2={width - paddingX}
          y2={targetY}
          stroke="#d64545"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {points.length > 1 ? <polyline fill="none" stroke="#175cd3" strokeWidth="2" points={path} /> : null}
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="2.5" fill="#175cd3" />
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

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
  const targetY = toY(targetLevel)

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
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} stroke="#edf1f7" />
            <text x={8} y={tick.y + 4} fontSize="11" fill="#5f6c89">
              {tick.label}
            </text>
          </g>
        ))}

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="#9eabc6"
          strokeWidth="1.5"
        />
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="#9eabc6"
          strokeWidth="1.5"
        />

        <line
          x1={paddingLeft}
          y1={targetY}
          x2={width - paddingRight}
          y2={targetY}
          stroke="#d64545"
          strokeWidth="2"
          strokeDasharray="5 5"
        />

        {points.length > 1 ? <polyline fill="none" stroke="#175cd3" strokeWidth="3" points={polyline} /> : null}

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
            <circle cx={point.x} cy={point.y} r="5" fill="#175cd3" pointerEvents="none" />
            <line
              x1={point.x}
              y1={height - paddingBottom}
              x2={point.x}
              y2={height - paddingBottom + 5}
              stroke="#9eabc6"
            />
          </g>
        ))}

        {points.map((point) => (
          <text key={`label-${point.id}`} x={point.x} y={height - 8} fontSize="10" textAnchor="middle" fill="#5f6c89">
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
              fill="#0f1726"
              fillOpacity="0.92"
              stroke="#2d3954"
            />
            {tooltipLines.map((line, index) => (
              <text
                key={`${activePoint.id}-${index}`}
                x={tooltipX + 10}
                y={tooltipY + 22 + index * 18}
                fontSize="12"
                fill="#f7f9ff"
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
      </div>
    </div>
  )
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chartSpacingMode, setChartSpacingMode] = useState<ChartSpacingMode>('equal')
  const [language, setLanguage] = useState<Language>('ko')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [chatbotKeyPrefix, setChatbotKeyPrefix] = useState<string | null>(null)
  const [chatbotKeyIssuedAt, setChatbotKeyIssuedAt] = useState<string | null>(null)
  const [newChatbotApiKey, setNewChatbotApiKey] = useState<string | null>(null)
  const [isIssuingChatbotKey, setIsIssuingChatbotKey] = useState(false)
  const [isRevokingChatbotKey, setIsRevokingChatbotKey] = useState(false)
  const [chatbotKeyNotice, setChatbotKeyNotice] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const text = TEXT[language]
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || '?'

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

  const editingTargetGoal = useMemo(
    () => goals.find((goal) => goal.id === editingGoalId) ?? null,
    [goals, editingGoalId],
  )

  const recordTargetGoal = useMemo(
    () => goals.find((goal) => goal.id === recordGoalId) ?? null,
    [goals, recordGoalId],
  )

  const sortedRecords = useMemo(
    () => (recordTargetGoal ? getRecordsByDateAsc(recordTargetGoal.inputs) : []),
    [recordTargetGoal],
  )

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

  const openCreateGoalForm = () => {
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
    setEditingGoalId(goal.id)
    setGoalForm({
      name: goal.name,
      targetDate: goal.targetDate,
      targetLevel: String(goal.targetLevel),
      unit: goal.unit,
    })
    setGoalFormOpen(true)
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
    } catch {
      setErrorMessage(text.errors.saveGoal)
    }
  }

  const handleDeleteGoal = async () => {
    if (editingGoalId === null) {
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
    setInputGoalId(goal.id)
    setEditingInputId(null)
    setInputForm({
      date: getToday(),
      level: '',
      message: '',
    })
  }

  const openInputEditForm = (goalId: number, record: GoalInput) => {
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
    } catch {
      setErrorMessage(text.errors.saveRecord)
    }
  }

  const handleDeleteRecord = async (goalId: number, recordId: number) => {
    try {
      await requestApi(`/goals/${goalId}/records/${recordId}`, { method: 'DELETE' })
      await loadGoals()
    } catch {
      setErrorMessage(text.errors.deleteRecord)
    }
  }

  const openRecordView = (goalId: number) => {
    setRecordGoalId(goalId)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>{text.appTitle}</h1>
        <div className="header-actions">
          <button type="button" className="primary" onClick={openCreateGoalForm}>
            {text.addGoal}
          </button>
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-trigger"
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
        <section className="panel" aria-label="settings-panel">
          <h2>{text.settings}</h2>
          <div className="settings-row">
            <span>{text.chartSpacingLabel}</span>
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
            <span>{text.languageLabel}</span>
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
          <div className="chatbot-key-panel">
            <h3>{text.chatbotApiKeyTitle}</h3>
            <p className="empty">{text.chatbotApiKeyDesc}</p>
            <p>{text.chatbotApiKeyActivePrefix}: {chatbotKeyPrefix ?? text.chatbotApiKeyMissing}</p>
            <p>{text.chatbotApiKeyIssuedAt}: {chatbotKeyIssuedAt ?? '-'}</p>
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
        <section className="panel" aria-label="goal-form">
          <h2>{editingTargetGoal ? text.goalEdit : text.goalCreate}</h2>
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
              {editingTargetGoal ? (
                <button type="button" className="danger" onClick={() => void handleDeleteGoal()}>
                  {text.delete}
                </button>
              ) : null}
            </div>
          </form>
        </section>
      )}

      {inputTargetGoal && (
        <section className="panel" aria-label="input-form">
          <h2>
            {inputTargetGoal.name} - {editingInputId === null ? text.statusInput : text.recordEdit}
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
              {text.currentLevel} ({inputTargetGoal.unit})
              <input
                type="number"
                step="any"
                value={inputForm.level}
                onChange={(event) => setInputForm((prev) => ({ ...prev, level: event.target.value }))}
                placeholder={`e.g. 3 (${inputTargetGoal.unit})`}
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
      )}

      {recordTargetGoal && (
        <section className="panel" aria-label="record-view">
          <div className="record-header">
            <h2>{recordTargetGoal.name} - {text.recordView}</h2>
            <button type="button" onClick={() => setRecordGoalId(null)}>
              {text.close}
            </button>
          </div>

          <TrendChart
            records={sortedRecords}
            targetLevel={recordTargetGoal.targetLevel}
            unit={recordTargetGoal.unit}
            spacingMode={chartSpacingMode}
            text={text}
          />

          <div className="record-list-wrap">
            <h3>{text.recordList}</h3>
            {sortedRecords.length === 0 ? (
              <p className="empty">{text.noRecords}</p>
            ) : (
              <ul className="record-list">
                {[...sortedRecords].reverse().map((record) => (
                  <li key={record.id} className="record-item">
                    <div className="record-text">
                      <span>
                        {record.date} - {record.level} {recordTargetGoal.unit}
                      </span>
                      {record.message ? <span className="record-message">{record.message}</span> : null}
                    </div>
                    <div className="record-actions">
                      <button type="button" onClick={() => openInputEditForm(recordTargetGoal.id, record)}>
                        {text.edit}
                      </button>
                      <button type="button" onClick={() => void handleDeleteRecord(recordTargetGoal.id, record.id)}>
                        {text.delete}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="list-wrap">
        <h2>{text.goalList}</h2>

        {goals.length === 0 ? (
          <p className="empty">{text.noGoalsYet}</p>
        ) : (
          <ul className="goal-list">
            {goals.map((goal) => {
              const latestInput = getLatestRecord(goal.inputs)

              return (
                <li key={goal.id} className="goal-item">
                  <div className="goal-meta">
                    <div className="goal-main">
                      <strong>{goal.name}</strong>
                      <p>
                        {text.goalPrefix} {goal.targetLevel} {goal.unit} ({goal.targetDate})
                      </p>
                      {latestInput ? (
                        <p>
                          {text.latestInput} {latestInput.level} {goal.unit} ({latestInput.date})
                        </p>
                      ) : (
                        <p>
                          {text.latestInput} {text.none}
                        </p>
                      )}
                    </div>
                    <MiniTrendChart
                      records={goal.inputs}
                      targetLevel={goal.targetLevel}
                      spacingMode={chartSpacingMode}
                      emptyLabel={text.miniNoRecords}
                      ariaLabel={text.miniProgressChartAria}
                    />
                  </div>

                  <div className="goal-actions">
                    <button type="button" className="primary" onClick={() => openInputForm(goal)}>
                      {text.enterStatus}
                    </button>
                    <button type="button" onClick={() => openRecordView(goal.id)}>
                      {text.viewRecords}
                    </button>
                    <button type="button" onClick={() => openEditGoalForm(goal)}>
                      {text.edit}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App










