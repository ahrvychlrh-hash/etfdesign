import { handleChat } from '../server/chat.js'

// Vercel 서버리스 함수: POST /api/chat — 모아와 대화 (Gemini)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
  const { status, body: out } = await handleChat(body, env)
  return Response.json(out, { status, headers: { 'Cache-Control': 'no-store' } })
}
