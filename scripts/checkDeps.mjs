/**
 * scripts/checkDeps.mjs   (npm run check:deps)
 *
 * Dependency audit: scans every import in the frontend (src/, config files)
 * and backend (backend/, excluding tests' dev-only packages) and verifies each
 * bare package specifier is declared in the matching package.json. Prevents
 * "Cannot find package 'xyz'" surprises. Also verifies installed state.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtinModules } from 'node:module'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
const IMPORT_RE = /(?:import\s+(?:[^'"]*?\s+from\s+)?|import\(|require\()\s*['"]([^'"]+)['"]/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'coverage'].includes(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.js', '.jsx', '.mjs', '.cjs'].includes(extname(name))) out.push(full)
  }
  return out
}

function pkgName(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || builtins.has(spec)) return null
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function check(label, dir, pkgPath, skipDirs = []) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})])
  const prodDeclared = new Set(Object.keys(pkg.dependencies || {}))
  const missing = new Map()
  const prodMissing = new Map()
  const nodeModules = join(dir, 'node_modules')

  for (const file of walk(dir)) {
    const rel = relative(root, file).replace(/\\/g, '/')
    if (skipDirs.some((s) => rel.startsWith(s))) continue
    const isTestOrTool = /(^|\/)(tests?|scripts)\/|\.test\.|\.config\.|vitest\.config|eslint\.config/.test(rel)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT_RE)) {
      const name = pkgName(m[1])
      if (!name) continue
      if (!declared.has(name)) (missing.get(name) || missing.set(name, []).get(name)).push(rel)
      else if (!isTestOrTool && label === 'backend' && !prodDeclared.has(name)) {
        (prodMissing.get(name) || prodMissing.set(name, []).get(name)).push(rel)
      }
    }
  }

  let ok = true
  for (const [name, files] of missing) { ok = false; console.log(`  ✖ ${label}: "${name}" is imported but not in package.json (${files[0]})`) }
  for (const [name, files] of prodMissing) { ok = false; console.log(`  ✖ ${label}: "${name}" is used at runtime but only in devDependencies (${files[0]})`) }

  const notInstalled = [...declared].filter((d) => !existsSync(join(nodeModules, d)))
  if (notInstalled.length) {
    console.log(`  ⚠ ${label}: ${notInstalled.length} declared package(s) not installed (run "npm run setup"): ${notInstalled.slice(0, 5).join(', ')}${notInstalled.length > 5 ? ', …' : ''}`)
    if (process.argv.includes('--require-installed')) ok = false
  }
  if (ok) console.log(`  ✔ ${label}: all imports are declared`)
  return ok
}

console.log('Dependency check')
const a = check('frontend', root, join(root, 'package.json'), ['backend/'])
const b = check('backend', join(root, 'backend'), join(root, 'backend/package.json'))
process.exit(a && b ? 0 : 1)
