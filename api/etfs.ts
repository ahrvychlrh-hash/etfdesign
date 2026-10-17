import { handleApi } from '../server/yahoo'

// Vercel 서버리스 함수: GET /api/etfs — 국내 상장 ETF 전체 목록
export async function GET(request: Request) {
  const { status, body } = await handleApi(new URL(request.url))
  return Response.json(body, { status, headers: { 'Cache-Control': 's-maxage=3600' } })
}
