import { useCallback, useEffect, useRef, useState } from 'react'
import MainApp from './MainApp'

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
const CHATBOT_GUIDE_HASH = '#/chatbot-guide'

const isGuideHash = () => window.location.hash === CHATBOT_GUIDE_HASH

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

  const guideUrl = `${window.location.origin}/${CHATBOT_GUIDE_HASH}`

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
          <a href="#/">{text.home}</a>
        </p>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const [loginLanguage, setLoginLanguage] = useState<'ko' | 'en'>('ko')
  const [guideRoute, setGuideRoute] = useState(isGuideHash())
  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const text = {
    ko: {
      appTitle: '\uC791\uC2EC\uC0AC\uC77C',
      loginTitle: 'Google \uB85C\uADF8\uC778',
      loginDescription: '\uAD6C\uAE00 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uBA74 \uB0B4 \uBAA9\uD45C/\uC124\uC815\uC774 \uBD84\uB9AC\uB418\uC5B4 \uAD00\uB9AC\uB429\uB2C8\uB2E4.',
      loginButtonHint: '\uB85C\uADF8\uC778 \uBC84\uD2BC\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...',
      missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.',
      loginFailed: '\uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
      guestLogin: '\uAC8C\uC2A4\uD2B8\uB85C \uB85C\uADF8\uC778',
      guestLoginFailed: '\uAC8C\uC2A4\uD2B8 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
      chatbotGuide: '\uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC',
      loading: '\uBD88\uB7EC\uC624\uB294 \uC911...',
    },
    en: {
      appTitle: 'Day4',
      loginTitle: 'Google Login',
      loginDescription: 'Sign in with Google to keep goals/settings separate per user.',
      loginButtonHint: 'Loading sign-in button...',
      missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID is not configured.',
      loginFailed: 'Login failed. Please try again.',
      guestLogin: 'Continue as Guest',
      guestLoginFailed: 'Guest login failed.',
      chatbotGuide: 'Chatbot Integration Guide',
      loading: 'Loading...',
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
  }, [])

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setErrorMessage(null)
      const result = await requestApi<AuthGoogleResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      localStorage.setItem(AUTH_TOKEN_KEY, result.token)
      setUser(result.user)
    } catch {
      setErrorMessage(text.loginFailed)
    }
  }, [text.loginFailed])

  const handleGuestLogin = useCallback(async () => {
    try {
      setErrorMessage(null)
      const result = await requestApi<AuthGuestResponse>('/auth/guest', {
        method: 'POST',
      })
      localStorage.setItem(AUTH_TOKEN_KEY, result.token)
      setUser(result.user)
    } catch {
      setErrorMessage(text.guestLoginFailed)
    }
  }, [text.guestLoginFailed])

  useEffect(() => {
    const onHashChange = () => setGuideRoute(isGuideHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (guideRoute) {
      document.title = loginLanguage === 'ko'
        ? '\uC791\uC2EC\uC0AC\uC77C - \uCC57\uBD07 \uC5F0\uB3D9 \uAC00\uC774\uB4DC'
        : 'Day4 - Chatbot Integration Guide'
      return
    }

    void loadMe()
  }, [guideRoute, loadMe, loginLanguage])

  useEffect(() => {
    if (guideRoute || user || !GOOGLE_CLIENT_ID) {
      return
    }

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) {
        return false
      }

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
      setIsGoogleReady(true)
      return true
    }

    if (initGoogle()) {
      return
    }

    const timer = window.setInterval(() => {
      if (initGoogle()) {
        window.clearInterval(timer)
      }
    }, 250)

    return () => window.clearInterval(timer)
  }, [guideRoute, handleGoogleCredential, user])

  useEffect(() => {
    if (guideRoute) {
      return
    }
    document.title = user ? 'Day4' : `${text.appTitle} - ${text.loginTitle}`
  }, [guideRoute, text.appTitle, text.loginTitle, user])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setErrorMessage(null)
    setUser(null)
  }, [])

  if (guideRoute) {
    return <ChatbotGuidePage />
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>{text.appTitle}</h1>
          <p className="empty">{text.loading}</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>{text.appTitle}</h1>
          <h2>{text.loginTitle}</h2>
          <p>{text.loginDescription}</p>

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

          {GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className="google-button-slot" /> : null}
          {!GOOGLE_CLIENT_ID ? <p className="error-text">{text.missingGoogleClientId}</p> : null}
          {GOOGLE_CLIENT_ID && !isGoogleReady ? <p className="empty">{text.loginButtonHint}</p> : null}
          <button type="button" className="secondary guest-login-button" onClick={() => void handleGuestLogin()}>
            {text.guestLogin}
          </button>
          <p className="guide-link-wrap">
            <a href={CHATBOT_GUIDE_HASH}>{text.chatbotGuide}</a>
          </p>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </section>
      </main>
    )
  }

  const activeUser = user ?? { id: 0, name: 'Guest' }
  const profileName = activeUser.name || activeUser.email || `user-${activeUser.id}`

  return <MainApp profileName={profileName} onLogout={handleLogout} />
}

export default App
