import { handleApi } from '../server/yahoo.js'

// Vercel 서버리스 함수: GET /api/search?q=SCHD
export async function GET(request: Request) {
  const { status, body } = await handleApi(new URL(request.url))
  return Response.json(body, { status, headers: { 'Cache-Control': 's-maxage=3600' } })
}
