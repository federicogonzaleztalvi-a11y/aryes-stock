import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // es2022 target: prevents esbuild from transforming const/let declarations
    // which was causing Temporal Dead Zone (TDZ) errors in production
    target: 'es2022',
  },
})
