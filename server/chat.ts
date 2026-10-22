/**
 * 모아와 대화 — Google Gemini API (무료 키) 연동.
 * 키는 서버 환경변수 GEMINI_API_KEY에만 두고, 브라우저에는 보내지 않습니다.
 * - GEMINI_MODEL: 쓸 모델을 직접 정할 때 (비우면 쓸 수 있는 최신 Flash 모델을 자동으로 고름)
 * - CHAT_PASSWORD: 정해 두면 이 비밀번호를 아는 사람만 대화할 수 있음 (무료 한도를 남이 쓰지 않게)
 * 개발 서버(vite)와 배포 서버(Vercel 함수)가 이 모듈을 함께 씁니다.
 */

export type ChatEnv = Record<string, string | undefined>

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface ChatRequest {
  messages?: ChatMessage[]
  context?: string
  password?: string
}

const API = 'https://generativelanguage.googleapis.com/v1beta'
/** 한 번에 보내는 대화 수·길이 제한 (무료 한도와 응답 속도를 위해) */
const MAX_TURNS = 12
const MAX_TEXT = 2000
const MAX_CONTEXT = 12000

const SYSTEM = `너는 'ETF DESIGN' 앱의 캐릭터 '모아'야. 동전처럼 차곡차곡 모으는 걸 좋아하는 작고 친절한 로봇이야.
사용자는 이 앱으로 ETF 장기 투자 포트폴리오를 관리해. 아래 [내 포트폴리오]는 앱이 방금 계산한 사용자의 실제 데이터야.

규칙:
- 항상 한국어 존댓말(~요)로, 쉽고 다정하게 답해. 투자 초보도 이해하게 어려운 말은 풀어서 설명해.
- 답은 짧게: 보통 3~8문장. 꼭 필요할 때만 '- '로 시작하는 짧은 목록을 쓰고, 강조는 **굵게**만 써. 표·제목(#)·코드블록은 쓰지 마.
- 숫자는 [내 포트폴리오]에 있는 값만 써. 없는 값은 지어내지 말고 "앱에 그 정보가 없어요"라고 말해.
- 금액 정보가 없으면 비중(%)과 수익률로만 이야기해.
- 리밸런싱·추가 매수 질문은 사용자가 정한 목표 비중과 앱의 계산 결과를 바탕으로 설명해.
- 특정 종목을 "꼭 사세요/파세요"처럼 단정하지 마. 장단점과 생각해 볼 점을 알려 주고, 결정은 사용자 몫이라는 걸 필요할 때 짧게 덧붙여.
- 시장 전망·내일 주가 같은 예측은 할 수 없다고 솔직하게 말하고, 장기 분산 투자 관점으로 이야기해.
- 투자와 상관없는 질문도 짧게 친절히 답하되, 자연스럽게 포트폴리오 이야기로 돌아와.`

export async function handleChat(raw: unknown, env: ChatEnv): Promise<{ status: number; body: unknown }> {
  const key = env.GEMINI_API_KEY?.trim()
  if (!key) return { status: 503, body: { code: 'nokey', error: '서버에 Gemini API 키가 아직 없어요.' } }

  const req = (raw ?? {}) as ChatRequest
  const password = env.CHAT_PASSWORD?.trim()
  if (password && req.password !== password) {
    return { status: 401, body: { code: 'password', error: '비밀번호가 맞지 않아요.' } }
  }

  const messages = (Array.isArray(req.messages) ? req.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_TEXT) }] }))
  // Gemini는 사용자 말로 시작해야 함
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return { status: 400, body: { code: 'bad', error: '질문이 비어 있어요.' } }
  }

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const context = typeof req.context === 'string' ? req.context.slice(0, MAX_CONTEXT) : ''
  const payload = {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\n오늘 날짜(한국): ${today}\n\n[내 포트폴리오]\n${context || '(데이터 없음)'}` }] },
    contents: messages,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  }

  const models = await pickModels(key, env.GEMINI_MODEL?.trim())
  let last = { status: 502, body: { code: 'fail', error: '모아가 지금 대답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.' } as unknown }
  for (const model of models) {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    }).catch(() => null)
    if (!res) continue
    const j = (await res.json().catch(() => ({}))) as GeminiResponse
    if (res.ok) {
      const text = (j.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim()
      if (text) return { status: 200, body: { text, model } }
      last = { status: 502, body: { code: 'empty', error: '모아가 이 질문에는 대답하기 어려워요. 다르게 물어봐 주세요.' } }
      continue
    }
    // 키가 잘못됐으면 다른 모델로 바꿔도 같음
    if ((res.status === 400 || res.status === 403) && /API key/i.test(j.error?.message ?? '')) {
      return { status: 502, body: { code: 'badkey', error: 'Gemini API 키가 올바르지 않아요.' } }
    }
    if (res.status === 429) {
      last = { status: 429, body: { code: 'limit', error: '오늘 무료 사용량을 다 썼거나 너무 자주 물어봤어요. 잠시 뒤 다시 물어봐 주세요.' } }
    }
    // 404(모델 없음)·429(한도)·5xx(혼잡) 등은 다음 모델로
  }
  return last
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  error?: { message?: string }
}

/* ---------- 모델 고르기 ---------- */

let cached: { at: number; list: string[] } | null = null

/**
 * 쓸 모델 순서. 이름이 자주 바뀌어서 Google에 쓸 수 있는 모델 목록을 물어보고
 * 정식 Flash(버전 높은 순) → Flash 최신 별칭 → Flash-Lite 순으로 시도합니다.
 */
async function pickModels(key: string, preferred?: string): Promise<string[]> {
  const fallback = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
  if (!cached || Date.now() - cached.at > 3600_000) {
    try {
      const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })
      const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
      const names = (j.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
      const version = (n: string) => Number(/^gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0)
      const byVersion = (a: string, b: string) => version(b) - version(a)
      const flash = names.filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort(byVersion)
      const lite = names.filter((n) => /^gemini-\d+(\.\d+)?-flash-lite$/.test(n)).sort(byVersion)
      const alias = names.filter((n) => n === 'gemini-flash-latest' || n === 'gemini-flash-lite-latest')
      const list = [...flash.slice(0, 2), ...alias, ...lite.slice(0, 1)]
      if (list.length) cached = { at: Date.now(), list }
    } catch {
      // 목록을 못 받으면 기본 이름으로 시도
    }
  }
  const list = cached?.list ?? fallback
  return [...new Set([...(preferred ? [preferred] : []), ...list])].slice(0, 4)
}
