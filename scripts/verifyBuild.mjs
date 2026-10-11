/**
 * scripts/verifyBuild.mjs   (npm run verify:build)
 *
 * Verifies the production build is a complete, installable, offline-capable PWA:
 * index.html, manifest (+icons), service worker, offline page, and a precache
 * manifest that lists the JS/CSS bundles so the first offline launch works.
 * Also fails if anything that looks like a secret is inside dist/.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const dist = join(projectRoot, 'dist')
const errors = []
const ok = (m) => console.log(`  ✔ ${m}`)
const fail = (m) => { errors.push(m); console.log(`  ✖ ${m}`) }
const need = (rel) => (existsSync(join(dist, rel)) ? (ok(rel), true) : (fail(`missing dist/${rel}`), false))

console.log('PWA / build verification')
if (!existsSync(dist)) { console.log('  ✖ dist/ not found — run "npm run build" first'); process.exit(1) }

need('index.html'); need('sw.js'); need('offline.html'); need('manifest.webmanifest')

if (need('precache-manifest.json')) {
  const m = JSON.parse(readFileSync(join(dist, 'precache-manifest.json'), 'utf8'))
  const urls = m.urls || []
  m.version ? ok(`precache version ${m.version}`) : fail('precache manifest has no version')
  const js = urls.filter((u) => u.endsWith('.js') && u.startsWith('/assets/'))
  const css = urls.filter((u) => u.endsWith('.css'))
  js.length ? ok(`precache lists ${js.length} JS bundle(s)`) : fail('precache lists no JS bundle')
  css.length ? ok(`precache lists ${css.length} CSS file(s)`) : fail('precache lists no CSS')
  for (const need of ['/', '/offline.html', '/manifest.webmanifest']) urls.includes(need) ? ok(`precache includes ${need}`) : fail(`precache is missing ${need}`)
  const missing = urls.filter((u) => u !== '/' && !existsSync(join(dist, u.slice(1))))
  missing.length ? fail(`precache lists files not in dist: ${missing.slice(0, 3).join(', ')}`) : ok('every precached file exists in dist')
}

try {
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'))
  manifest.display === 'standalone' ? ok('manifest is installable (standalone)') : fail('manifest display is not standalone')
  for (const icon of manifest.icons || []) existsSync(join(dist, icon.src.slice(1))) ? ok(`icon ${icon.src}`) : fail(`missing icon ${icon.src}`)
  if (!manifest.icons?.some((i) => i.sizes === '512x512')) fail('no 512x512 icon')
} catch { fail('manifest.webmanifest is not valid JSON') }

const sw = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : ''
sw.includes('/api/') ? ok('service worker excludes /api/ from caching') : fail('service worker does not exclude /api/')
sw.includes('precache-manifest.json') ? ok('service worker uses the precache manifest') : fail('service worker ignores the precache manifest')

const html = readFileSync(join(dist, 'index.html'), 'utf8')
html.includes('manifest.webmanifest') ? ok('index.html links the manifest') : fail('index.html does not link the manifest')

// Secret scan of the shipped bundle
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f] })
const pattern = /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|GEMINI_API_KEY|JWT_SECRET|MONGODB_URI|VAPID_PRIVATE_KEY|RESEND_API_KEY/
const leaks = walk(dist).filter((f) => /\.(js|css|html|json|webmanifest)$/.test(f) && pattern.test(readFileSync(f, 'utf8')))
leaks.length ? fail(`possible secret in: ${leaks.join(', ')}`) : ok('no secret patterns in dist/')

console.log(errors.length ? `\n${errors.length} problem(s)` : '\nBuild verified')
process.exit(errors.length ? 1 : 0)
