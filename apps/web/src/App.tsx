import { useCallback, useEffect, useRef, useState } from 'react'
import MainApp from './MainApp'
import AdFitSlot from './AdFitSlot'
import mcpSetupImage from './assets/mcp-chatgpt-setup.svg'

type AuthUser = {
  id: number
  email?: string | null
  name?: string | null
}

type AuthGoogleResponse = {
  token: string
  user: AuthUser
}

type AuthMeResponse = {
  user: AuthUser
}

type AuthGuestResponse = {
  token: string
  user: AuthUser
}

type PreviewGoalInput = {
  id: number
  date: string
  level: number
  message?: string
}

type PreviewGoal = {
  id: number
  name: string
  targetDate: string
  targetLevel: number
  unit: string
  inputs: PreviewGoalInput[]
}

type GuestPreviewResponse = {
  profileName: string
  goals: PreviewGoal[]
}

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
}

type GoogleButtonConfiguration = {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void
          prompt: () => void
        }
      }
    }
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:8787/api`
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const AUTH_TOKEN_KEY = 'day4_auth_token'
const CHATBOT_GUIDE_PATH = '/chatbot-guide'
const MCP_GUIDE_PATH = '/mcp-guide'
const CHATBOT_GUIDE_HASH = '#/chatbot-guide'
const MCP_GUIDE_HASH = '#/mcp-guide'
const GUEST_ROUTE_PATH = '/guest'

type GuideRoute = 'none' | 'chatbot' | 'mcp'
type PublicRoute = 'none' | 'about' | 'privacy' | 'terms' | 'contact'

const getGuideRoute = (): GuideRoute => {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === CHATBOT_GUIDE_PATH || window.location.hash === CHATBOT_GUIDE_HASH) return 'chatbot'
  if (pathname === MCP_GUIDE_PATH || window.location.hash === MCP_GUIDE_HASH) return 'mcp'
  return 'none'
}

const getPublicRoute = (): PublicRoute => {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/about') return 'about'
  if (pathname === '/privacy') return 'privacy'
  if (pathname === '/terms') return 'terms'
  if (pathname === '/contact') return 'contact'
  return 'none'
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

  return (await response.json()) as T
}

function ChatbotGuidePage() {
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')

  const text = {
    ko: {
      appTitle: '\uC791\uC2EC\uC0AC\uC77C',
      pageTitle: '\uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
      summary: '\uC678\uBD80 \uCC57\uBD07\uC774 Day4 API\uB97C \uD1B5\uD574 \uBAA9\uD45C \uC0C1\uD0DC\uB97C \uAE30\uB85D\uD558\uB294 \uBC29\uBC95\uC785\uB2C8\uB2E4.',
      home: '\uB85C\uADF8\uC778 \uD654\uBA74\uC73C\uB85C',
      sectionUrl: '\uCC57\uBD07\uC5D0 \uC804\uB2EC\uD560 \uAC00\uC774\uB4DC URL',
      sectionFlow: '\uC5F0\uB3D9 \uC21C\uC11C',
      step1: '1) Day4 \uB85C\uADF8\uC778 \uD6C4 \uB0B4 \uD1A0\uD070\uC73C\uB85C \uCC57\uBD07 \uD1A0\uD070 \uBC1C\uAE09',
      step2: '2) \uCC57\uBD07 \uD1A0\uD070\uC73C\uB85C \uB0B4 \uBAA9\uD45C \uBAA9\uB85D \uC870\uD68C',
      step3: '3) \uBAA9\uD45C ID\uB85C \uC0C1\uD0DC \uC785\uB825',
      sectionEndpoints: '\uD544\uC218 API',
      token: 'GET /api/chatbot/api-key, POST /api/chatbot/api-key/issue (in Day4 app settings)',
      goals: 'GET /api/chatbot/goals (Authorization: Bearer <chatbot_api_key>)',
      record: 'POST /api/chatbot/records (Authorization: Bearer <chatbot_api_key>)',
      sampleTitle: '\uC0C1\uD0DC \uC785\uB825 \uC608\uC2DC',
      sampleTip: 'goalId \uC0AC\uC6A9\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4. (\uB3D9\uBA85\uC774\uB984 \uCDA9\uB3CC \uBC29\uC9C0)',
    },
    en: {
      appTitle: 'Day4',
      pageTitle: 'Chatbot Integration Guide',
      summary: 'How external chatbots can write goal status records through Day4 API.',
      home: 'Back to login',
      sectionUrl: 'Guide URL to share with chatbot',
      sectionFlow: 'Integration flow',
      step1: '1) Issue a user-scoped chatbot API key in Day4 settings',
      step2: '2) Use chatbot API key to fetch my goal list',
      step3: '3) Write status by goal ID',
      sectionEndpoints: 'Required APIs',
      token: 'GET /api/chatbot/api-key, POST /api/chatbot/api-key/issue (in Day4 app settings)',
      goals: 'GET /api/chatbot/goals (Authorization: Bearer <chatbot_api_key>)',
      record: 'POST /api/chatbot/records (Authorization: Bearer <chatbot_api_key>)',
      sampleTitle: 'Record payload example',
      sampleTip: 'Use goalId to avoid duplicate-name ambiguity.',
    },
  }[language]

  const guideUrl = `${window.location.origin}${CHATBOT_GUIDE_PATH}`

  return (
    <main className="guide-page">
      <section className="guide-card">
        <h1>{text.appTitle}</h1>
        <h2>{text.pageTitle}</h2>
        <p>{text.summary}</p>

        <div className="settings-row auth-lang-row">
          <label className="settings-option">
            <input type="radio" name="guide-language" checked={language === 'ko'} onChange={() => setLanguage('ko')} />
            {'\uD55C\uAD6D\uC5B4'}
          </label>
          <label className="settings-option">
            <input type="radio" name="guide-language" checked={language === 'en'} onChange={() => setLanguage('en')} />
            English
          </label>
        </div>

        <h3>{text.sectionUrl}</h3>
        <pre className="guide-code">{guideUrl}</pre>

        <h3>{text.sectionFlow}</h3>
        <ul className="guide-list">
          <li>{text.step1}</li>
          <li>{text.step2}</li>
          <li>{text.step3}</li>
        </ul>

        <h3>{text.sectionEndpoints}</h3>
        <ul className="guide-list">
          <li>{text.token}</li>
          <li>{text.goals}</li>
          <li>{text.record}</li>
        </ul>

        <h3>{text.sampleTitle}</h3>
        <pre className="guide-code">{`{
  "goalId": 12,
  "date": "2026-02-20",
  "level": 72.5,
  "message": "today progress"
}`}</pre>
        <p className="empty">{text.sampleTip}</p>

        <p>
          <a href="/">{text.home}</a>
        </p>
      </section>
    </main>
  )
}

function McpGuidePage() {
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const text = {
    ko: {
      appTitle: '\uC791\uC2EC\uC0AC\uC77C',
      pageTitle: 'MCP \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
      summary: 'ChatGPT MCP\uC5D0\uC11C Day4 \uC0C1\uD0DC\uB97C \uC785\uB825\uD558\uB294 \uBC29\uBC95\uC785\uB2C8\uB2E4. \uD604\uC7AC \uBC29\uC2DD\uC740 \uB9E4 \uD638\uCD9C\uB9C8\uB2E4 apiKey \uC804\uB2EC\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
      home: '\uB85C\uADF8\uC778 \uD654\uBA74\uC73C\uB85C',
      sectionUrl: 'MCP Server URL',
      copyUrl: 'URL \uBCF5\uC0AC',
      copied: '\uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
      copyFailed: '\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uC73C\uB85C \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.',
      sectionFlow: '\uC5F0\uB3D9 \uC21C\uC11C',
      step1: '1) ChatGPT\uC5D0 MCP \uC11C\uBC84 URL \uB4F1\uB85D',
      step2: '2) API \uD0A4(day4_ck_...)\uB294 \uD504\uB85C\uD544 > \uC124\uC815 > \uCC57\uBD07 API \uD0A4\uC5D0\uC11C \uBC1C\uAE09\uD569\uB2C8\uB2E4.',
      step2b: '3) list_goals \uD638\uCD9C \uC2DC \uBC1C\uAE09\uD55C apiKey\uB97C \uD3EC\uD568\uD569\uB2C8\uB2E4.',
      step3: '4) list_goal_records / add_goal_record / update_goal_record / delete_goal_record / add_goal_records_batch \uD638\uCD9C \uC2DC apiKey\uC640 \uBAA9\uD45C/\uC0C1\uD0DC \uAC12\uC744 \uD3EC\uD568\uD569\uB2C8\uB2E4.',
      sectionChatgpt: 'ChatGPT \uC6F9 \uC124\uC815 (\uAC1C\uBC1C\uC790 \uBAA8\uB4DC)',
      chatgptStep1: '1) ChatGPT \uC6F9\uC5D0\uC11C \uC6B0\uC0C1\uB2E8 \uD504\uB85C\uD544\uC744 \uB204\uB985\uB2C8\uB2E4.',
      chatgptStep2: '2) \uC124\uC815 -> \uC571 -> \uACE0\uAE09 \uC124\uC815 -> \uAC1C\uBC1C\uC790 \uBAA8\uB4DC -> \uC571 \uB9CC\uB4E4\uAE30 \uBA54\uB274\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.',
      chatgptStep3: '3) MCP URL\uC5D0 https://day4-mcp.onrender.com/mcp \uB97C \uC785\uB825\uD569\uB2C8\uB2E4.',
      chatgptStep4: '4) \uC778\uC99D \uBC29\uBC95\uC740 \uC81C\uD55C\uC5C6\uC74C(None)\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.',
      chatgptStep5: '5) \uC800\uC7A5 \uD6C4 list_goals, list_goal_records, add_goal_record, update_goal_record, delete_goal_record, add_goal_records_batch \uB3C4\uAD6C\uAC00 \uBCF4\uC774\uB294\uC9C0 \uD655\uC778\uD569\uB2C8\uB2E4.',
      sectionImage: '\uC124\uC815 \uD654\uBA74 \uC548\uB0B4 \uC774\uBBF8\uC9C0',
      sectionTools: '\uB3C4\uAD6C \uC785\uB825 \uC608\uC2DC',
    },
    en: {
      appTitle: 'Day4',
      pageTitle: 'MCP Integration Guide',
      summary: 'How to write Day4 status updates via ChatGPT MCP. Current mode requires apiKey on every tool call.',
      home: 'Back to login',
      sectionUrl: 'MCP Server URL',
      copyUrl: 'Copy URL',
      copied: 'Copied.',
      copyFailed: 'Copy failed. Please copy manually.',
      sectionFlow: 'Flow',
      step1: '1) Register MCP server URL in ChatGPT',
      step2: '2) Issue apiKey(day4_ck_...) in Profile > Settings > Chatbot API Key.',
      step2b: '3) Call list_goals with issued apiKey.',
      step3: '4) Call list_goal_records/add_goal_record/update_goal_record/delete_goal_record/add_goal_records_batch with apiKey',
      sectionChatgpt: 'ChatGPT Web Setup (Developer Mode)',
      chatgptStep1: '1) In ChatGPT Web, click your profile menu (top-right).',
      chatgptStep2: '2) Go to Settings -> Apps -> Advanced settings -> Developer mode -> Build app.',
      chatgptStep3: '3) Set MCP URL: https://day4-mcp.onrender.com/mcp',
      chatgptStep4: '4) Choose authentication method: Unrestricted (None).',
      chatgptStep5: '5) Save and confirm list_goals, list_goal_records, add_goal_record, update_goal_record, delete_goal_record, add_goal_records_batch are visible.',
      sectionImage: 'Setup Reference Image',
      sectionTools: 'Tool input examples',
    },
  }[language]

  const mcpUrl = 'https://day4-mcp.onrender.com/mcp'

  const handleCopy = async () => {
    const fallbackCopy = (value: string) => {
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

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mcpUrl)
      } else {
        fallbackCopy(mcpUrl)
      }
      setCopyStatus('ok')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      try {
        fallbackCopy(mcpUrl)
        setCopyStatus('ok')
        window.setTimeout(() => setCopyStatus('idle'), 2000)
      } catch {
        setCopyStatus('fail')
      }
    }
  }

  return (
    <main className="guide-page">
      <section className="guide-card">
        <h1>{text.appTitle}</h1>
        <h2>{text.pageTitle}</h2>
        <p>{text.summary}</p>

        <div className="settings-row auth-lang-row">
          <label className="settings-option">
            <input type="radio" name="mcp-guide-language" checked={language === 'ko'} onChange={() => setLanguage('ko')} />
            {'\uD55C\uAD6D\uC5B4'}
          </label>
          <label className="settings-option">
            <input type="radio" name="mcp-guide-language" checked={language === 'en'} onChange={() => setLanguage('en')} />
            English
          </label>
        </div>

        <h3>{text.sectionUrl}</h3>
        <div className="guide-code-block">
          <div className="guide-code-head">
            <button type="button" className="guide-copy-button" onClick={() => void handleCopy()}>
              {text.copyUrl}
            </button>
          </div>
          <pre className="guide-code">{mcpUrl}</pre>
        </div>
        {copyStatus === 'ok' ? <p className="empty">{text.copied}</p> : null}
        {copyStatus === 'fail' ? <p className="error-text">{text.copyFailed}</p> : null}

        <h3>{text.sectionFlow}</h3>
        <ul className="guide-list">
          <li>{text.step1}</li>
          <li>{text.step2}</li>
          <li>{text.step3}</li>
        </ul>

        <h3>{text.sectionChatgpt}</h3>
        <ul className="guide-list">
          <li>{text.chatgptStep1}</li>
          <li>{text.chatgptStep2}</li>
          <li>{text.chatgptStep3}</li>
          <li>{text.chatgptStep4}</li>
          <li>{text.chatgptStep5}</li>
        </ul>

        <h3>{text.sectionImage}</h3>
        <img
          src={mcpSetupImage}
          alt={language === 'ko' ? '\uCC57GPT \uC6F9 MCP \uC124\uC815 \uACBD\uB85C \uC548\uB0B4 \uC774\uBBF8\uC9C0' : 'ChatGPT web MCP setup flow image'}
          className="guide-image"
        />

        <h3>{text.sectionTools}</h3>
        <pre className="guide-code">{`list_goals
{
  "apiKey": "day4_ck_xxx"
}

list_goal_records
{
  "apiKey": "day4_ck_xxx",
  "goalId": 12,
  "limit": 20
}

add_goal_record
{
  "apiKey": "day4_ck_xxx",
  "goalId": 12,
  "date": "2026-02-20",
  "level": 72.5,
  "message": "today progress"
}

update_goal_record
{
  "apiKey": "day4_ck_xxx",
  "recordId": 345,
  "date": "2026-02-21",
  "level": 73.0,
  "message": "edited"
}

delete_goal_record
{
  "apiKey": "day4_ck_xxx",
  "recordId": 345
}

add_goal_records_batch
{
  "apiKey": "day4_ck_xxx",
  "records": [
    {
      "goalId": 12,
      "date": "2026-02-20",
      "level": 72.5,
      "message": "today progress"
    },
    {
      "goalId": 12,
      "date": "2026-02-21",
      "level": 73.0,
      "message": "next day"
    }
  ]
}`}</pre>

        <p>
          <a href="/">{text.home}</a>
        </p>
      </section>
    </main>
  )
}


function SiteFooterLinks() {
  return (
    <nav className="site-footer-links" aria-label="Site links">
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
    </nav>
  )
}

function PublicInfoPage({ route }: { route: Exclude<PublicRoute, 'none'> }) {
  const content = {
    about: {
      eyebrow: 'About Day4',
      title: 'Day4',
      summary: 'A simple goal tracking app for recording progress, reviewing trends, and keeping daily effort visible.',
      sections: [
        {
          heading: 'What it does',
          body: 'Day4 lets each user manage goals, record daily status, review charts, and keep settings separate by account.',
        },
        {
          heading: 'How to use it',
          body: 'Sign in with Google or enter guest mode, create goals, then keep adding records with date, level, and notes.',
        },
      ],
    },
    privacy: {
      eyebrow: 'Privacy Policy',
      title: 'Privacy',
      summary: 'Day4 stores only the minimum account and goal data required to provide personal goal tracking, settings sync, and optional chatbot integrations.',
      sections: [
        {
          heading: 'Data we collect',
          body: 'Day4 stores account profile fields returned by login providers, user settings, goals, goal records, and chatbot API keys that are explicitly issued by the user.',
        },
        {
          heading: 'Purpose of use',
          body: 'This data is used to provide sign-in, separate user workspaces, charts, trend prediction, settings persistence, and user-authorized external integrations.',
        },
        {
          heading: 'Data sharing and retention',
          body: 'Day4 does not sell user data. Stored data remains in the service database until the operator removes it for maintenance purposes or the service structure changes.',
        },
      ],
    },
    terms: {
      eyebrow: 'Terms of Use',
      title: 'Terms',
      summary: 'Day4 is provided as a personal goal management service. By using it, you agree not to misuse the app, the API, or issued access keys.',
      sections: [
        {
          heading: 'Acceptable use',
          body: 'Do not attempt unauthorized access, overload the service, bypass account boundaries, or use issued chatbot API keys for other users or systems without permission.',
        },
        {
          heading: 'Availability and changes',
          body: 'Features, UI, limits, integrations, and storage structure may change at any time as the product evolves. The service may also be temporarily unavailable for maintenance or debugging.',
        },
        {
          heading: 'User responsibility',
          body: 'Users are responsible for the accuracy of their own records and for keeping issued API keys private. Continued use after changes are published means those changes are accepted.',
        },
      ],
    },
    contact: {
      eyebrow: 'Contact',
      title: 'Contact',
      summary: 'For product feedback, bug reports, or account questions, contact the operator by email.',
      sections: [
        {
          heading: 'Email',
          body: 'fnt.jany.ai@gmail.com',
        },
        {
          heading: 'Scope',
          body: 'Please include the page, action, and date of the issue so it can be reproduced quickly.',
        },
      ],
    },
  }[route]

  return (
    <main className="guide-page public-page">
      <section className="guide-card public-card">
        <p className="auth-eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.summary}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="public-section">
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        ))}
        <p className="guide-link-wrap">
          <a href="/">Day4 Home</a>
        </p>
        <SiteFooterLinks />
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [guestPreview, setGuestPreview] = useState<GuestPreviewResponse | null>(null)
  const [loginLanguage, setLoginLanguage] = useState<'ko' | 'en'>('ko')
  const [guideRoute, setGuideRoute] = useState<GuideRoute>(getGuideRoute())
  const publicRoute = getPublicRoute()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const text = {
    ko: {
      appTitle: '\uC791\uC2EC\uC0AC\uC77C',
      loginTitle: 'Google \uB85C\uADF8\uC778',
      loginDescription: '\uAD6C\uAE00 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uBA74 \uB0B4 \uBAA9\uD45C/\uC124\uC815\uC774 \uBD84\uB9AC\uB418\uC5B4 \uAD00\uB9AC\uB429\uB2C8\uB2E4.',
      landingEyebrow: '\uB9E4\uC77C \uAE30\uB85D\uD558\uB294 \uBAA9\uD45C \uAD00\uB9AC',
      landingTitle: '\uBAA9\uD45C\uB97C \uC791\uAC8C \uC313\uACE0, \uCD94\uC138\uB85C \uD655\uC778\uD558\uB294 Day4',
      landingSummary: '\uBAA9\uD45C, \uAE30\uB85D, \uCD94\uC138 \uC608\uCE21\uC744 \uD55C \uD654\uBA74\uC5D0\uC11C \uBCF4\uACE0 \uB9E4\uC77C \uBCC0\uD654\uB97C \uC313\uC5B4 \uAC08 \uC218 \uC788\uB294 \uAC1C\uC778 \uBAA9\uD45C \uD2B8\uB798\uCEE4\uC785\uB2C8\uB2E4.',
      landingFeature1: '\uBAA9\uD45C\uBCC4 \uAE30\uB85D \uCD94\uAC00 \uBC0F \uCD94\uC138 \uADF8\uB798\uD504',
      landingFeature2: '\uACC4\uC815\uBCC4 \uC124\uC815 \uBC0F \uBAA9\uD45C \uBD84\uB9AC \uAD00\uB9AC',
      landingFeature3: '\uAC8C\uC2A4\uD2B8 \uCCB4\uD5D8 \uACFC MCP/\uCC57\uBD07 \uC5F0\uB3D9 \uC9C0\uC6D0',
      guestPreviewTitle: '\uAC8C\uC2A4\uD2B8 \uB370\uBAA8 \uBAA9\uD45C',
      guestPreviewDescription: '\uB85C\uADF8\uC778 \uC5C6\uC774\uB3C4 Day4\uC758 \uBAA9\uD45C \uCE74\uB4DC \uAD6C\uC131\uC744 \uBC14\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
      guestPreviewTarget: '\uBAA9\uD45C',
      guestPreviewLatest: '\uCD5C\uADFC \uAE30\uB85D',
      guestPreviewEmpty: '\uD45C\uC2DC\uD560 \uB370\uBAA8 \uBAA9\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.',
      none: '\uC5C6\uC74C',
      loginButtonHint: '\uB85C\uADF8\uC778 \uBC84\uD2BC\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...',
      signingIn: '\uB85C\uADF8\uC778 \uC911\uC785\uB2C8\uB2E4...',
      missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.',
      missingGoogleScript: 'Google \uB85C\uADF8\uC778 \uC2A4\uD06C\uB9BD\uD2B8\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
      googleScriptLoadFailed: 'Google \uB85C\uADF8\uC778 \uC2A4\uD06C\uB9BD\uD2B8 \uB85C\uB529\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
      loginFailed: '\uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
      googleInitFailed: 'Google \uB85C\uADF8\uC778 \uBC84\uD2BC \uCD08\uAE30\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
      googleInitTimeout: 'Google \uB85C\uADF8\uC778 \uBC84\uD2BC \uCD08\uAE30\uD654\uAC00 \uC9C0\uC5F0\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4. Google Cloud Console\uC758 Origin \uC124\uC815\uC744 \uD655\uC778\uD558\uC138\uC694.',
      guestLogin: '\uAC8C\uC2A4\uD2B8\uB85C \uB85C\uADF8\uC778',
      guestLoginFailed: '\uAC8C\uC2A4\uD2B8 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
      chatbotGuide: '\uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
      mcpGuide: 'MCP \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
      loading: '\uBD88\uB7EC\uC624\uB294 \uC911...',
      guestPageTitle: '\uAC8C\uC2A4\uD2B8 \uCCB4\uD5D8',
      guestPageDescription: 'Google \uB85C\uADF8\uC778 \uC5C6\uC774 Day4\uB97C \uBC14\uB85C \uCCB4\uD5D8\uD558\uC138\uC694. \uAC8C\uC2A4\uD2B8 \uBAA8\uB4DC\uC5D0\uC11C\uB3C4 \uBAA9\uD45C\uC640 \uAE30\uB85D \uAE30\uB2A5\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
      backToMainLogin: '\uBA54\uC778 \uB85C\uADF8\uC778\uC73C\uB85C',
    },
    en: {
      appTitle: 'Day4',
      loginTitle: 'Google Login',
      loginDescription: 'Sign in with Google to keep goals/settings separate per user.',
      landingEyebrow: 'Daily goal tracking',
      landingTitle: 'Track goals, review trends, and keep progress visible in Day4',
      landingSummary: 'Day4 is a personal goal tracker for adding daily records, reviewing trend lines, and keeping progress organized by user.',
      landingFeature1: 'Goal-specific records and compact trend charts',
      landingFeature2: 'Per-user settings and separated workspaces',
      landingFeature3: 'Guest mode plus chatbot and MCP integration support',
      guestPreviewTitle: 'Guest demo goals',
      guestPreviewDescription: 'Preview Day4 goal cards directly on the public landing page without signing in.',
      guestPreviewTarget: 'Target',
      guestPreviewLatest: 'Latest',
      guestPreviewEmpty: 'No demo goals available.',
      none: 'None',
      loginButtonHint: 'Loading sign-in button...',
      signingIn: 'Signing in...',
      missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID is not configured.',
      missingGoogleScript: 'Google sign-in script tag is missing.',
      googleScriptLoadFailed: 'Failed to load Google sign-in script.',
      loginFailed: 'Login failed. Please try again.',
      googleInitFailed: 'Failed to initialize Google sign-in button.',
      googleInitTimeout: 'Google sign-in initialization is taking too long. Check allowed JavaScript origins in Google Cloud Console.',
      guestLogin: 'Continue as Guest',
      guestLoginFailed: 'Guest login failed.',
      chatbotGuide: 'Chatbot Integration Guide',
      mcpGuide: 'MCP Integration Guide',
      loading: 'Loading...',
      guestPageTitle: 'Guest Experience',
      guestPageDescription: 'Try Day4 instantly without Google login. In guest mode, you can freely explore test data.',
      backToMainLogin: 'Go to main login',
    },
  }[loginLanguage]

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const result = await requestApi<AuthMeResponse>('/auth/me')
      setUser(result.user)
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [text.guestLoginFailed])

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setIsAuthenticating(true)
      setErrorMessage(null)
      const result = await requestApi<AuthGoogleResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      localStorage.setItem(AUTH_TOKEN_KEY, result.token)
      setUser(result.user)
    } catch {
      setErrorMessage(text.loginFailed)
    } finally {
      setIsAuthenticating(false)
    }
  }, [text.loginFailed])

  const handleGuestLogin = useCallback(async () => {
    try {
      setIsAuthenticating(true)
      setErrorMessage(null)
      const result = await requestApi<AuthGuestResponse>('/auth/guest', {
        method: 'POST',
      })
      localStorage.setItem(AUTH_TOKEN_KEY, result.token)
      setUser(result.user)
    } catch {
      setErrorMessage(text.guestLoginFailed)
    } finally {
      setIsAuthenticating(false)
    }
  }, [text.guestLoginFailed])

  useEffect(() => {
    const syncGuideRoute = () => setGuideRoute(getGuideRoute())
    window.addEventListener('hashchange', syncGuideRoute)
    window.addEventListener('popstate', syncGuideRoute)
    return () => {
      window.removeEventListener('hashchange', syncGuideRoute)
      window.removeEventListener('popstate', syncGuideRoute)
    }
  }, [])

  useEffect(() => {
    if (publicRoute !== 'none') {
      document.title = `Day4 - ${publicRoute.charAt(0).toUpperCase()}${publicRoute.slice(1)}`
      return
    }

    if (guideRoute !== 'none') {
      if (guideRoute === 'chatbot') {
        document.title = loginLanguage === 'ko'
          ? '\uC791\uC2EC\uC0AC\uC77C - \uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC'
          : 'Day4 - Chatbot Integration Guide'
      } else {
        document.title = loginLanguage === 'ko'
          ? '\uC791\uC2EC\uC0AC\uC77C - MCP \uC5F0\uB3D9 \uAC00\uC774\uB4DC'
          : 'Day4 - MCP Integration Guide'
      }
      return
    }

    void loadMe()
  }, [guideRoute, loadMe, loginLanguage, publicRoute])

  useEffect(() => {
    if (guideRoute !== 'none' || publicRoute !== 'none' || user || !GOOGLE_CLIENT_ID || isLoading) {
      return
    }

    let settled = false
    const googleScript = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]')
    if (!googleScript) {
      setErrorMessage(`${text.missingGoogleScript} (${window.location.origin})`)
      return
    }

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) {
        return false
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) {
              void handleGoogleCredential(response.credential)
            }
          },
        })

        googleButtonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280,
        })
        settled = true
        setErrorMessage(null)
        setIsGoogleReady(true)
        return true
      } catch (error) {
        settled = true
        const reason = error instanceof Error ? error.message : String(error)
        setErrorMessage(`${text.googleInitFailed} (${reason})`)
        return false
      }
    }

    const onGoogleScriptError = () => {
      settled = true
      setErrorMessage(`${text.googleScriptLoadFailed} (${window.location.origin})`)
    }
    googleScript.addEventListener('error', onGoogleScriptError)

    if (initGoogle()) {
      googleScript.removeEventListener('error', onGoogleScriptError)
      return
    }

    const timer = window.setInterval(() => {
      if (initGoogle()) {
        window.clearInterval(timer)
        window.clearTimeout(timeoutTimer)
      }
    }, 250)

    const timeoutTimer = window.setTimeout(() => {
      if (!settled) {
        setErrorMessage(`${text.googleInitTimeout} (${window.location.origin})`)
      }
    }, 8000)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(timeoutTimer)
      googleScript.removeEventListener('error', onGoogleScriptError)
    }
  }, [
    guideRoute,
    publicRoute,
    handleGoogleCredential,
    text.googleInitFailed,
    text.googleInitTimeout,
    text.googleScriptLoadFailed,
    text.missingGoogleScript,
    isLoading,
    user,
  ])

  useEffect(() => {
    if (guideRoute !== 'none' || publicRoute !== 'none' || user) {
      return
    }

    let cancelled = false

    const loadGuestPreview = async () => {
      try {
        const result = await requestApi<GuestPreviewResponse>('/public/guest-preview')
        if (!cancelled) {
          setGuestPreview(result)
        }
      } catch {
        if (!cancelled) {
          setGuestPreview(null)
        }
      }
    }

    void loadGuestPreview()

    return () => {
      cancelled = true
    }
  }, [guideRoute, publicRoute, user])

  useEffect(() => {
    if (guideRoute !== 'none' || publicRoute !== 'none') {
      return
    }
    document.title = user ? 'Day4' : `${text.appTitle} - ${text.loginTitle}`
  }, [guideRoute, publicRoute, text.appTitle, text.loginTitle, user])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setErrorMessage(null)
    setUser(null)
  }, [])

  if (guideRoute === 'chatbot') {
    return <ChatbotGuidePage />
  }

  if (guideRoute === 'mcp') {
    return <McpGuidePage />
  }

  if (publicRoute !== 'none') {
    return <PublicInfoPage route={publicRoute} />
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-card-loading">
          <p className="auth-eyebrow">Day4</p>
          <h1>{text.appTitle}</h1>
          <p className="empty auth-description">{text.loading}</p>
        </section>
      </main>
    )
  }

  if (!user) {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
    const isGuestPage = pathname === GUEST_ROUTE_PATH

    if (isGuestPage) {
      return (
        <main className="auth-page">
          <section className="auth-card auth-card-guest">
            <p className="auth-eyebrow">Guest</p>
            <h1>{text.appTitle}</h1>
            <h2>{text.guestPageTitle}</h2>
            <p className="auth-description">{text.guestPageDescription}</p>

            <div className="settings-row auth-lang-row">
              <label className="settings-option">
                <input type="radio" name="auth-language" checked={loginLanguage === 'ko'} onChange={() => setLoginLanguage('ko')} />
                {'\uD55C\uAD6D\uC5B4'}
              </label>
              <label className="settings-option">
                <input type="radio" name="auth-language" checked={loginLanguage === 'en'} onChange={() => setLoginLanguage('en')} />
                English
              </label>
            </div>

            <div className="auth-actions">
              <button type="button" className="secondary guest-login-button" onClick={() => void handleGuestLogin()} disabled={isAuthenticating}>
              {text.guestLogin}
              </button>
            </div>
            <p className="guide-link-wrap auth-links">
              <a href="/">{text.backToMainLogin}</a>
            </p>
            <p className="guide-link-wrap">
              <a href={CHATBOT_GUIDE_PATH}>{text.chatbotGuide}</a>
              {' | '}
              <a href={MCP_GUIDE_PATH}>{text.mcpGuide}</a>
            </p>
            <SiteFooterLinks />
            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          </section>
          <AdFitSlot />
        </main>
      )
    }

    return (
      <main className="auth-page auth-page-landing">
        <div className="auth-stack">
          <section className="auth-card auth-card-login">
          <p className="auth-eyebrow">{text.landingEyebrow}</p>
          <h1>{text.appTitle}</h1>
          <h2>{text.landingTitle}</h2>
          <p className="auth-description">{text.landingSummary}</p>
          <ul className="landing-feature-list">
            <li>{text.landingFeature1}</li>
            <li>{text.landingFeature2}</li>
            <li>{text.landingFeature3}</li>
          </ul>
          <p className="auth-description auth-signin-copy">{text.loginDescription}</p>

          <div className="settings-row auth-lang-row">
            <label className="settings-option">
              <input type="radio" name="auth-language" checked={loginLanguage === 'ko'} onChange={() => setLoginLanguage('ko')} />
              {'\uD55C\uAD6D\uC5B4'}
            </label>
            <label className="settings-option">
              <input type="radio" name="auth-language" checked={loginLanguage === 'en'} onChange={() => setLoginLanguage('en')} />
              English
            </label>
          </div>

          <div className="auth-actions auth-actions-stacked">
            {!isAuthenticating && GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className="google-button-slot" /> : null}
            {!GOOGLE_CLIENT_ID ? <p className="error-text">{text.missingGoogleClientId}</p> : null}
            {isAuthenticating ? <p className="empty auth-status">{text.signingIn}</p> : null}
            {GOOGLE_CLIENT_ID && !isGoogleReady && !isAuthenticating ? <p className="empty auth-status">{text.loginButtonHint}</p> : null}
            <button type="button" className="secondary guest-login-button" onClick={() => void handleGuestLogin()}>
              {text.guestLogin}
            </button>
          </div>
          <p className="guide-link-wrap auth-links">
            <a href={CHATBOT_GUIDE_PATH}>{text.chatbotGuide}</a>
            {' | '}
            <a href={MCP_GUIDE_PATH}>{text.mcpGuide}</a>
          </p>
          <SiteFooterLinks />
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          </section>

          <section className="auth-card landing-preview-card">
            <p className="auth-eyebrow">{text.guestPreviewTitle}</p>
            <h2>{text.guestPreviewDescription}</h2>
            {guestPreview && guestPreview.goals.length > 0 ? (
              <div className="landing-preview-grid">
                {guestPreview.goals.map((goal) => {
                  const latest = goal.inputs[0]
                  return (
                    <article key={goal.id} className="landing-preview-item">
                      <h3>{goal.name}</h3>
                      <p><strong>{text.guestPreviewTarget}</strong> {goal.targetLevel} {goal.unit} {'-'} {goal.targetDate}</p>
                      <p>
                        <strong>{text.guestPreviewLatest}</strong>{' '}
                        {latest ? `${latest.level} ${goal.unit} - ${latest.date}` : text.none}
                      </p>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="empty">{text.guestPreviewEmpty}</p>
            )}
          </section>
          <AdFitSlot />
        </div>
      </main>
    )
  }

  const activeUser = user ?? { id: 0, name: 'Guest' }
  const profileName = activeUser.name || activeUser.email || `user-${activeUser.id}`

  return (
    <>
      <MainApp profileName={profileName} onLogout={handleLogout} />
      <footer className="site-footer-shell">
        <SiteFooterLinks />
      </footer>
    </>
  )
}

export default App
