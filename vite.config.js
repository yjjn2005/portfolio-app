import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 배포 시 repository 이름으로 base를 변경하세요.
// 예: repo 이름이 'portfolio-app' 이면 → base: '/portfolio-app/'
// username.github.io 저장소 사용 시 → base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/portfolio-app/',
})
