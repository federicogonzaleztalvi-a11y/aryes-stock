import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    // SW cache versioning — inject build timestamp
    {
      name: 'sw-version',
      async closeBundle() {
        const fs = await import('fs');
        const swFile = 'dist/sw.js';
        if (fs.existsSync(swFile)) {
          const v = Date.now().toString(36);
          let sw = fs.readFileSync(swFile, 'utf8');
          sw = sw.replace('BUILD_VERSION', "'" + v + "'");
          fs.writeFileSync(swFile, sw, 'utf8');
          console.log('  SW version injected:', v);
        }
      },
    },
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({ org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN })] : []),
  ],
  build: {
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-router': ['react-router-dom'],
        },
      },
    },
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
// cache-bust: 1774817312
