import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/tai-va-xiu/' // 👈 tên repo GitHub của m ở đây
})
