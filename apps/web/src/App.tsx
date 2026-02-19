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

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const [loginLanguage, setLoginLanguage] = useState<'ko' | 'en'>('ko')
  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const text = {
    ko: {
      appTitle: '작심사일',
      loginTitle: 'Google 로그인',
      loginDescription: '구글 계정으로 로그인하면 내 목표/설정이 분리되어 관리됩니다.',
      loginButtonHint: '로그인 버튼을 불러오는 중입니다...',
      missingGoogleClientId: 'VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.',
      loginFailed: '로그인에 실패했습니다. 다시 시도해 주세요.',
      guestLogin: '\uAC8C\uC2A4\uD2B8\uB85C \uB85C\uADF8\uC778',
      guestLoginFailed: '\uAC8C\uC2A4\uD2B8 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
      loading: '불러오는 중...',
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
    void loadMe()
  }, [loadMe])

  useEffect(() => {
    if (user || !GOOGLE_CLIENT_ID) {
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
  }, [handleGoogleCredential, user])

  useEffect(() => {
    document.title = user ? 'Day4' : `${text.appTitle} - ${text.loginTitle}`
  }, [text.appTitle, text.loginTitle, user])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setErrorMessage(null)
    setUser(null)
  }, [])

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
              한국어
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
