export type ThemeDefinition = {
  id: string
  label: {
    ko: string
    en: string
  }
  tokens: Record<string, string>
}
