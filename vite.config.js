import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({ org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN })] : []),
  ],
  build: {
    // es2022 target: prevents esbuild from transforming const/let declarations
    // which was causing Temporal Dead Zone (TDZ) errors in production
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    // jsdom needed because ui.jsx imports React (has JSX components alongside
    // pure math helpers — splitting would be over-engineering for now)
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx', 'api/**/*.test.js'],
    // Provide env vars so requireEnv() in constants.js doesn't throw on import
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**'],
    },
  },
})
