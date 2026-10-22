import { chatStatus, chatStream, prepareChat } from '../server/chat.js'

const env = () => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

// Vercel 서버리스 함수: POST /api/chat — 모아와 대화 (Gemini). 답은 글자가 나오는 대로 한 줄씩 보냄
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const p = prepareChat(body, env())
  if ('error' in p) return Response.json(p.error.body, { status: p.error.status, headers: { 'Cache-Control': 'no-store' } })
  return new Response(chatStream(p.key, p.req, p.preferred), {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// GET /api/chat — 서버에 키·비밀번호가 있는지
export async function GET() {
  return Response.json(chatStatus(env()), { headers: { 'Cache-Control': 'no-store' } })
}
