import { handleApi } from '../server/yahoo.js'

// Vercel 서버리스 함수: GET /api/benchmarks — 자산군별 기초지수 30년 평균 수익률
export async function GET(request: Request) {
  const { status, body } = await handleApi(new URL(request.url))
  return Response.json(body, { status, headers: { 'Cache-Control': 's-maxage=86400' } })
}
