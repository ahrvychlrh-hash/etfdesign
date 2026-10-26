import { handleMarket } from '../server/market.js'

// Vercel 서버리스 함수: GET /api/market?view=now | history&id=kospi&range=1y | monthly — 시장 지수
export async function GET(request: Request) {
  try {
    const { status, body, maxAge } = await handleMarket(new URL(request.url))
    return Response.json(body, { status, headers: { 'Cache-Control': maxAge ? `s-maxage=${maxAge}` : 'no-store' } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'error' }, { status: 502 })
  }
}
