import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 127.0.0.1, not localhost: uvicorn listens on IPv4 only and "localhost"
        // tries IPv6 first, adding ~2 s to every call on Windows.
        // API_TARGET points it elsewhere (e.g. http://backend:8000 in Docker).
        target: process.env.API_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
