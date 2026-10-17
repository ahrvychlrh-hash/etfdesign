import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './server/yahoo'

/** 개발 중에도 /api/* 를 Vercel 함수와 똑같이 처리 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const { status, body } = await handleApi(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'))
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
})
