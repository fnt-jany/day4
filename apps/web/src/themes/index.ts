import type { ThemeDefinition } from './types'

type ThemeModule = { default: ThemeDefinition }

const modules = import.meta.glob<ThemeModule>('./*.theme.ts', { eager: true })

export const THEMES: ThemeDefinition[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.id.localeCompare(b.id))

const THEME_IDS = new Set(THEMES.map((theme) => theme.id))
const ALL_THEME_TOKEN_KEYS = [...new Set(THEMES.flatMap((theme) => Object.keys(theme.tokens)))]

export const DEFAULT_THEME_ID = THEMES[0]?.id ?? 'day4-light'

export const normalizeThemeId = (value: unknown) => {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) return DEFAULT_THEME_ID
  return THEME_IDS.has(id) ? id : DEFAULT_THEME_ID
}

export const getThemeById = (themeId: string) => {
  const normalized = normalizeThemeId(themeId)
  return THEMES.find((theme) => theme.id === normalized) ?? THEMES[0]
}

export const applyThemeById = (themeId: string) => {
  const root = document.documentElement
  const theme = getThemeById(themeId)

  root.dataset.theme = theme.id

  for (const key of ALL_THEME_TOKEN_KEYS) {
    root.style.removeProperty(`--${key}`)
  }

  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${key}`, value)
  }

  return theme
}
