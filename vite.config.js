import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Served from https://belencorvillo.github.io/ignis-si-web/
  base: '/ignis-si-web/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
  },
})
