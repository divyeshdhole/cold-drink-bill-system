import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

// Load .env file
dotenv.config()
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // proxy all requests starting with /api to your backend
      '/api': {
        target: process.env.VITE_API_URL, // using .env value
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
