import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { handleApi } from './server/yahoo'
import { handleScan } from './server/scan'

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(null)
      }
    })
  })
}

/** 개발 중에도 /api/* 를 Vercel 함수와 똑같이 처리 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost')
        const { status, body } =
          req.method === 'POST' && url.pathname.endsWith('/scan') ? await handleScan(await readJson(req)) : await handleApi(url)
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 로컬 테스트용 키는 .env.local 의 ANTHROPIC_API_KEY (git에 안 올라감)
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY ??= env.ANTHROPIC_API_KEY
  return { plugins: [react(), devApi()] }
})
