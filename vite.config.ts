import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Luis-Josh/', // e.g. '/eventpulse-nc-site/'
})