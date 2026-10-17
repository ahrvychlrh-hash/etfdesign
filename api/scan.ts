import { handleScan } from '../server/scan.js'

// Vercel 서버리스 함수: POST /api/scan { images: [{ mediaType, data(base64) }] } — 증권 앱 캡처 읽기
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const { status, body: result } = await handleScan(body)
  return Response.json(result, { status })
}
