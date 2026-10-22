import { chatStatus, handleChat } from '../server/chat.js'

const env = () => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

// Vercel 서버리스 함수: POST /api/chat — 모아와 대화 (Gemini)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const { status, body: out } = await handleChat(body, env())
  return Response.json(out, { status, headers: { 'Cache-Control': 'no-store' } })
}

// GET /api/chat — 서버에 키·비밀번호가 있는지
export async function GET() {
  return Response.json(chatStatus(env()), { headers: { 'Cache-Control': 'no-store' } })
}
