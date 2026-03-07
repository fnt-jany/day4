import type { ThemeDefinition } from './types'

const theme: ThemeDefinition = {
  id: 'modern-premium',
  label: {
    ko: '\uBAA8\uB358 \uD504\uB9AC\uBBF8\uC5C4',
    en: 'Modern Premium',
  },
  tokens: {
    'bg-page': '#f3f6fa',
    'text-primary': '#1a202c',
    'text-muted': '#4a5568',
    'text-subtle': '#718096',
    'text-strong': '#111827',
    'surface': '#ffffff',
    'panel-bg': '#ffffff',
    'border-panel': 'rgba(0, 0, 0, 0.04)',
    'border-soft': 'rgba(0, 0, 0, 0.06)',
    'border-card': 'rgba(0, 0, 0, 0.05)',
    'input-border': '#e2e8f0',
    'primary': '#4f46e5', // Indigo 600
    'primary-contrast': '#ffffff',
    'secondary-text': '#4f46e5',
    'secondary-border': '#e2e8f0',
    'success-bg': '#f0fdf4',
    'success-text': '#166534',
    'success-border': '#bbf7d0',
    'warning-bg': '#fff1f2',
    'warning-text': '#991b1b',
    'warning-border': '#fecaca',
    'error-text': '#dc2626',
    'hover-bg': '#f8fafc',
    'hover-border': '#cbd5e1',
    'guide-head-bg': '#f8fafc',
    'guide-copy-border': '#e2e8f0',
    'guide-copy-text': '#475569',
    'guide-copy-hover': '#f1f5f9',
    'chart-grid': '#f1f5f9',
    'chart-axis': '#94a3b8',
    'chart-target': '#ef4444',
    'chart-trend': '#10b981',
    'chart-record': '#4f46e5',
    'profile-bg': '#4f46e5',
    'profile-border': '#4338ca',
    'shadow-elev': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  },
}

export default theme
