import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import.meta

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
})
