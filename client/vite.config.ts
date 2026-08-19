import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:3000"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 8080,
    watch: {
      // Docker Desktop and virtualized filesystems can miss native file events.
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
      "/media": {
        target: devProxyTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: devProxyTarget,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
