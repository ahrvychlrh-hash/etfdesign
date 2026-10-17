import { handleApi } from '../server/yahoo'

// Vercel 서버리스 함수: GET /api/quote?symbol=360750.KS
export async function GET(request: Request) {
  const { status, body } = await handleApi(new URL(request.url))
  return Response.json(body, { status, headers: { 'Cache-Control': 's-maxage=300' } })
}
