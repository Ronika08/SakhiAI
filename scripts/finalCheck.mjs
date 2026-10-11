/**
 * scripts/finalCheck.mjs   (npm run check:final)
 *
 * Release gate: verifies expected files exist, that no secret/.env file or key
 * pattern is present in the project tree, and that env examples hold only
 * placeholders. Run before packaging.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const errors = []
const ok = (m) => console.log(`  ✔ ${m}`)
const fail = (m) => { errors.push(m); console.log(`  ✖ ${m}`) }

const EXPECTED = [
  // frontend
  'src/SakhiAI.jsx', 'src/App.jsx', 'src/services/chatRouter.js', 'src/services/localKnowledge.js', 'src/services/connectivity.js',
  'src/services/syncQueue.js', 'src/services/syncHandlers.js', 'src/services/apiClient.js', 'src/services/locationService.js',
  'src/services/voiceState.js', 'src/hooks/useVoiceInput.js', 'src/components/VoiceButton.jsx', 'src/components/LanguageSelector.jsx',
  'src/components/ConnectivityPanel.jsx', 'src/components/SOSStatus.jsx', 'src/i18n/translations.js', 'src/i18n/LanguageContext.jsx',
  'src/data/kb/index.js', 'src/data/kb/core.js', 'src/data/kb/health.js', 'src/data/kb/safety.js',
  'src/services/chatService.js', 'src/constants/ruleEngineData.js', 'src/constants/medicalIntents.js',
  'src/pages/EmergencyPage.jsx', 'src/pages/TrustedCirclePage.jsx', 'src/pages/TrackerPage.jsx', 'src/pages/WellnessPage.jsx',
  'src/pages/CheckInPage.jsx', 'src/pages/SafeRoutePage.jsx', 'src/pages/ChatPage.jsx', 'src/pages/HomePage.jsx', 'src/pages/AuthPage.jsx',
  // PWA
  'public/manifest.webmanifest', 'public/sw.js', 'public/offline.html', 'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-maskable-512.png',
  // backend
  'backend/server.js', 'backend/app.js', 'backend/config/index.js', 'backend/services/geminiService.js', 'backend/services/aiProvider.js',
  'backend/services/chatSafetyService.js', 'backend/services/chatSafetyI18n.js', 'backend/services/notificationService.js',
  'backend/services/notificationProviders/webhookProvider.js', 'backend/services/notificationProviders/emailProvider.js',
  'backend/services/notificationProviders/webPushProvider.js', 'backend/services/emergencySOSService.js', 'backend/services/authService.js',
  'backend/services/tokenService.js', 'backend/controllers/voiceController.js', 'backend/routes/voiceRoutes.js',
  'backend/models/WellnessLog.js', 'backend/models/RefreshToken.js', 'backend/models/PasswordReset.js', 'backend/models/PushSubscription.js',
  'backend/env.example', 'backend/Dockerfile', 'backend/vitest.config.js', 'backend/scripts/checkGemini.js', 'backend/scripts/validateEnv.js',
  // project
  '.env.example', '.github/workflows/ci.yml', 'render.yaml', 'docker-compose.yml', 'Dockerfile.frontend', 'nginx.conf',
  'README.md', 'IMPLEMENTATION_SUMMARY.md', 'docs/ARCHITECTURE.md', 'docs/API.md', 'docs/DATABASE.md', 'docs/SECURITY.md', 'docs/DEPLOYMENT.md', 'docs/OFFLINE.md',
  'scripts/checkDeps.mjs', 'scripts/verifyBuild.mjs',
]

console.log('Final release check')
const missing = EXPECTED.filter((f) => !existsSync(join(root, f)))
missing.length ? missing.forEach((m) => fail(`missing file: ${m}`)) : ok(`all ${EXPECTED.length} expected files exist`)

const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage'])
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue
    const f = join(d, n)
    statSync(f).isDirectory() ? walk(f, out) : out.push(f)
  }
  return out
}
const files = walk(root)

const envFiles = files.map((f) => relative(root, f)).filter((f) => /(^|\/)\.env(\..*)?$/.test(f) && !/\.example$/.test(f))
envFiles.length ? envFiles.forEach((f) => fail(`real env file present: ${f}`)) : ok('no real .env files')

const KEY = /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{30,}|re_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|mongodb(\+srv)?:\/\/[^\s/:]+:[^\s@]+@/
const leaks = files.filter((f) => /\.(js|jsx|mjs|json|md|yml|yaml|html|example|css|webmanifest)$/.test(f) && !f.endsWith('package-lock.json') && KEY.test(readFileSync(f, 'utf8')))
leaks.length ? leaks.forEach((f) => fail(`possible secret in ${relative(root, f)}`)) : ok('no key / credential patterns in source')

for (const ex of ['backend/env.example', '.env.example']) {
  const text = readFileSync(join(root, ex), 'utf8')
  const bad = text.split('\n').filter((l) => /^(GEMINI_API_KEY|JWT_SECRET|RESEND_API_KEY|SMTP_PASS|VAPID_PRIVATE_KEY|GOOGLE_MAPS_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY)=/.test(l))
    .filter((l) => { const v = l.split('=')[1].split('#')[0].trim(); return v !== '' && !/^(your-|replace-)/.test(v) })
  bad.length ? bad.forEach((l) => fail(`${ex} contains a non-placeholder value: ${l.split('=')[0]}`)) : ok(`${ex} holds placeholders only`)
}

const gi = readFileSync(join(root, '.gitignore'), 'utf8')
;/^\.env$/m.test(gi) && /backend\/\.env/.test(gi) ? ok('.gitignore excludes .env files') : fail('.gitignore does not exclude .env files')

const fe = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const be = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8'))
for (const [label, pkg, needs] of [['frontend', fe, ['vitest', 'vite', 'react']], ['backend', be, ['express', 'compression', 'helmet', 'express-rate-limit', 'web-push', 'nodemailer', 'vitest', 'supertest']]]) {
  const have = { ...pkg.dependencies, ...pkg.devDependencies }
  const miss = needs.filter((n) => !have[n])
  miss.length ? fail(`${label} package.json is missing: ${miss.join(', ')}`) : ok(`${label} package.json declares its key packages`)
}

console.log(errors.length ? `\n${errors.length} problem(s)` : '\nRelease check passed')
process.exit(errors.length ? 1 : 0)
