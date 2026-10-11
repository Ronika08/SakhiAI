import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', 'backend/node_modules']),

  // ── Frontend (React + Vite) ─────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // Existing app syncs hook-provided values into state; refactoring is out of scope.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Context/provider modules legitimately export a hook next to the component.
  {
    files: ['src/context/**/*.{js,jsx}', 'src/i18n/**/*.{js,jsx}', 'src/components/Toast.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Pre-existing placeholder modules that contain bare identifiers (not imported anywhere).
  // Kept untouched so no existing file is removed or altered.
  {
    files: [
      'src/constants/appConfig.js', 'src/constants/healthTips.js', 'src/constants/helplines.js',
      'src/data/healthKnowledgeBase.js', 'src/services/cycleService.js',
    ],
    rules: { 'no-undef': 'off', 'no-unused-expressions': 'off' },
  },

  // Frontend tests
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
  },

  // Service worker
  {
    files: ['public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.serviceworker },
  },

  // ── Backend (Node ESM) ──────────────────────────────────────────────
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.vitest }, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['backend/tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Node scripts/config may use the console freely.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
