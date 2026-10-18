import { handleApi } from '../server/yahoo.js'

// Vercel 서버리스 함수: GET /api/monthend?month=2026-09&symbols=360750.KS,SCHD — 월말 종가(원화)
export async function GET(request: Request) {
  const { status, body } = await handleApi(new URL(request.url))
  return Response.json(body, { status, headers: { 'Cache-Control': 's-maxage=86400' } })
}
