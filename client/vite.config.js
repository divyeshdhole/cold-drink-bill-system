import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

// Load .env file
dotenv.config()
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()]
})
