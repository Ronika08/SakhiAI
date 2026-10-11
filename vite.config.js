import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Offline precache manifest.
 *
 * After the bundle is generated this plugin emits `precache-manifest.json`: the
 * list of every built asset (hashed JS/CSS/fonts) plus the public files the app
 * shell needs. The service worker downloads it at install time and caches all
 * of it, so the FIRST offline launch works — not only pages visited before.
 * The version is a hash of the file list, so any new build refreshes the cache.
 */
function precacheManifest() {
  return {
    name: 'sakhi-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const urls = new Set(['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/favicon.svg'])
      for (const file of Object.keys(bundle)) urls.add(`/${file}`)

      // public/ files (icons etc.) are copied after generateBundle, so list them from disk.
      const walk = (dir) => readdirSync(dir).flatMap((n) => {
        const full = join(dir, n)
        return statSync(full).isDirectory() ? walk(full) : [full]
      })
      try {
        for (const f of walk('public')) {
          const url = `/${relative('public', f).split('\\').join('/')}`
          if (!['/sw.js', '/precache-manifest.json'].includes(url)) urls.add(url)
        }
      } catch { /* no public dir */ }

      const list = [...urls].sort()
      const version = createHash('sha256').update(list.join('|')).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ version, urls: list }, null, 2),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheManifest()],
  build: { sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['backend/**', 'node_modules/**'],
  },
})
