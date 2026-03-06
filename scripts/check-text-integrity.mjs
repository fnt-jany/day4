import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const targets = [
  'apps/web/src/**/*.ts',
  'apps/web/src/**/*.tsx',
  'apps/api/**/*.js',
  'docs/**/*.md',
  'README.md',
]

const suspiciousPatterns = [
  { re: /\uFFFD/g, reason: 'replacement-char' },
  { re: /�/g, reason: 'replacement-char' },
  { re: /í•œêµ­ì–´/g, reason: 'known-mojibake-korean' },
  { re: /\?\?\?/g, reason: 'triple-question-mark' },
]

const files = [...new Set(targets.flatMap((pattern) => globSync(pattern, { nodir: true })))]
const findings = []

for (const file of files) {
  const buffer = readFileSync(file)

  if (buffer.includes(0)) {
    findings.push({ file, line: 1, reason: 'contains-null-byte', sample: '(binary?)' })
    continue
  }

  const text = buffer.toString('utf8')
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    for (const pattern of suspiciousPatterns) {
      if (pattern.re.test(line)) {
        findings.push({
          file,
          line: i + 1,
          reason: pattern.reason,
          sample: line.trim().slice(0, 140),
        })
        break
      }
    }
  }
}

if (findings.length > 0) {
  console.error('[text-integrity] suspicious text found:')
  for (const item of findings) {
    console.error(`- ${item.file}:${item.line} [${item.reason}] ${item.sample}`)
  }
  process.exit(1)
}

console.log('[text-integrity] ok')
