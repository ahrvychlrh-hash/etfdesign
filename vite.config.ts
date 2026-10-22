import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './server/yahoo'
import { chatStatus, chatStream, prepareChat } from './server/chat'

/** 개발 중에도 /api/* 를 Vercel 함수와 똑같이 처리 (Gemini 키는 .env.local의 GEMINI_API_KEY) */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (req.method === 'GET') {
          res.end(JSON.stringify(chatStatus({ ...env, ...process.env })))
          return
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body: unknown = null
        try {
          body = JSON.parse(raw)
        } catch {
          // 빈 요청
        }
        const p = prepareChat(body, { ...env, ...process.env })
        if ('error' in p) {
          res.statusCode = p.error.status
          res.end(JSON.stringify(p.error.body))
          return
        }
        // 답을 글자가 나오는 대로 흘려보냄 (Vercel 함수와 같은 방식)
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        const reader = chatStream(p.key, p.req, p.preferred).getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      })
      server.middlewares.use('/api', async (req, res) => {
        const { status, body } = await handleApi(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'))
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
  // 이 폴더(한글 경로)에서 파일 변경 알림을 놓치는 일이 있어서 주기적으로 확인
  server: { watch: { usePolling: true, interval: 300 } },
}))
