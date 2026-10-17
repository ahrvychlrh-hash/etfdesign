/**
 * 증권 앱 캡처 → 보유 종목 읽기 (Claude 이미지 인식).
 * 서버에 ANTHROPIC_API_KEY 환경 변수가 있어야 합니다.
 * dev 서버(vite)와 배포 서버(Vercel 함수)가 공통으로 사용합니다.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

const MAX_IMAGES = 6
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const ScanSchema = z.object({
  holdings: z.array(
    z.object({
      name: z.string(),
      code: z.string().nullable(),
      quantity: z.number().nullable(),
      invested: z.number().nullable(),
      value: z.number().nullable(),
      avgPrice: z.number().nullable(),
      currentPrice: z.number().nullable(),
      currency: z.enum(['KRW', 'USD']),
    }),
  ),
})

export type ScanResult = z.infer<typeof ScanSchema>
export type ScannedHolding = ScanResult['holdings'][number]

const PROMPT = `한국 증권사 앱(토스증권, 키움, 미래에셋, 삼성, NH, 한국투자 등)의 보유 종목(잔고) 화면 캡처입니다.
여러 장이면 같은 계좌를 스크롤한 화면일 수 있으니, 같은 종목이 겹치면 한 번만 적어주세요.

화면에 보이는 보유 종목을 모두 holdings에 담아주세요. 각 항목:
- name: 화면에 적힌 종목 이름 그대로 (예: "TIGER 미국S&P500", "SCHD")
- code: 6자리 국내 종목코드나 해외 티커가 보이면 그 값, 안 보이면 null
- quantity: 보유 수량(주). 소수점 수량도 그대로
- invested: 총 매입금액(원금)
- value: 현재 평가금액
- avgPrice: 1주당 평균 매입가(평균단가)
- currentPrice: 1주당 현재가
- currency: 위 금액들의 통화. 원화 금액이 보이면 원화로 적고 "KRW", 달러만 보이면 달러 금액과 "USD"

규칙:
- 숫자는 쉼표·단위 없이 숫자만 (예: 1,234,500원 → 1234500)
- 화면에 없는 값은 계산하거나 추측하지 말고 null
- 평가손익, 수익률, 예수금, 총자산 합계 줄은 종목이 아니니 넣지 마세요
- 종목 표가 보이지 않으면 holdings를 빈 배열로`

export async function handleScan(body: unknown): Promise<{ status: number; body: unknown }> {
  const images = parseImages(body)
  if (!images) return { status: 400, body: { error: '이미지를 1~6장 보내주세요' } }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: 500, body: { error: '서버에 ANTHROPIC_API_KEY가 설정되지 않았어요' } }
  }

  const client = new Anthropic()
  try {
    const message = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: betaZodOutputFormat(ScanSchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
            })),
            { type: 'text' as const, text: PROMPT },
          ],
        },
      ],
    })
    if (message.stop_reason === 'refusal') return { status: 422, body: { error: '이미지를 읽지 못했어요' } }
    if (message.stop_reason === 'max_tokens' || !message.parsed_output) {
      return { status: 502, body: { error: '결과를 정리하지 못했어요. 다시 시도해 주세요' } }
    }
    return { status: 200, body: message.parsed_output }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { status: 500, body: { error: 'API 키가 올바르지 않아요' } }
    if (e instanceof Anthropic.RateLimitError) return { status: 429, body: { error: '요청이 많아요. 잠시 후 다시 시도해 주세요' } }
    if (e instanceof Anthropic.BadRequestError) return { status: 400, body: { error: '이미지를 처리하지 못했어요' } }
    if (e instanceof Anthropic.APIError) return { status: 502, body: { error: `AI 서버 오류 (${e.status ?? '연결'})` } }
    return { status: 500, body: { error: e instanceof Error ? e.message : 'error' } }
  }
}

function parseImages(body: unknown): { mediaType: MediaType; data: string }[] | null {
  const list = (body as { images?: unknown })?.images
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_IMAGES) return null
  const out: { mediaType: MediaType; data: string }[] = []
  for (const item of list) {
    const { mediaType, data } = (item ?? {}) as { mediaType?: string; data?: string }
    if (!MEDIA_TYPES.includes(mediaType as MediaType) || typeof data !== 'string' || !data) return null
    out.push({ mediaType: mediaType as MediaType, data })
  }
  return out
}
