/**
 * 모아와 대화 — Google Gemini API (무료 키) 연동.
 * 서버 키는 환경변수 GEMINI_API_KEY에만 두고 브라우저에는 보내지 않습니다.
 * 서버 키가 없으면 사용자가 자기 키를 연결해 브라우저에서 바로 씁니다 (askGemini).
 * - GEMINI_MODEL: 쓸 모델을 직접 정할 때 (비우면 쓸 수 있는 최신 Flash 모델을 자동으로 고름)
 * - CHAT_PASSWORD: 정해 두면 이 비밀번호를 아는 사람만 대화할 수 있음 (무료 한도를 남이 쓰지 않게)
 * 개발 서버(vite)와 배포 서버(Vercel 함수)가 이 모듈을 함께 씁니다.
 *
 * 빠르게 답하도록: 글자를 만드는 대로 바로 흘려보내고(스트리밍), 답하기 전 '생각'은 가장 낮게,
 * 답 길이는 짧게, 모델 목록은 하루 동안 기억합니다.
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

type Result = { status: number; body: unknown }

const API = 'https://generativelanguage.googleapis.com/v1beta'
/** 한 번에 보내는 대화 수·길이 제한 (무료 한도와 응답 속도를 위해) */
const MAX_TURNS = 12
const MAX_TEXT = 2000
const MAX_CONTEXT = 12000
/** 답 최대 길이 (토큰) — 짧은 답이면 충분 */
const MAX_OUTPUT = 1024

const SYSTEM = `너는 'ETF DESIGN' 앱의 캐릭터 '모아'야. 동전처럼 차곡차곡 모으는 걸 좋아하는 작고 친절한 로봇이야.
사용자는 이 앱으로 ETF 장기 투자 포트폴리오를 관리해. 아래 [내 포트폴리오]는 앱이 방금 계산한 사용자의 실제 데이터야.

규칙:
- 항상 한국어 존댓말(~요)로, 쉽고 다정하게 답해. 투자 초보도 이해하게 어려운 말은 풀어서 설명해.
- 답은 짧게: 보통 3~6문장. 꼭 필요할 때만 '- '로 시작하는 짧은 목록(3개 이하)을 쓰고, 강조는 **굵게**만 써. 표·제목(#)·코드블록은 쓰지 마.
- 숫자는 [내 포트폴리오]에 있는 값만 써. 없는 값은 지어내지 말고 "앱에 그 정보가 없어요"라고 말해.
- 금액 정보가 없으면 비중(%)과 수익률로만 이야기해.
- 리밸런싱·추가 매수 질문은 사용자가 정한 목표 비중과 앱의 계산 결과를 바탕으로 설명해.
- 특정 종목을 "꼭 사세요/파세요"처럼 단정하지 마. 장단점과 생각해 볼 점을 알려 주고, 결정은 사용자 몫이라는 걸 필요할 때 짧게 덧붙여.
- 시장 전망·내일 주가 같은 예측은 할 수 없다고 솔직하게 말하고, 장기 분산 투자 관점으로 이야기해.
- 투자와 상관없는 질문도 짧게 친절히 답하되, 자연스럽게 포트폴리오 이야기로 돌아와.`

/** 서버 키·비밀번호 확인. 통과하면 Gemini에 물어볼 준비물을, 아니면 오류를 돌려줌 */
export function prepareChat(raw: unknown, env: ChatEnv): { error: Result } | { key: string; req: ChatRequest; preferred?: string } {
  const key = env.GEMINI_API_KEY?.trim()
  if (!key) return { error: { status: 503, body: { code: 'nokey', error: '서버에 Gemini API 키가 아직 없어요.' } } }
  const req = (raw ?? {}) as ChatRequest
  const password = env.CHAT_PASSWORD?.trim()
  if (password && req.password !== password) {
    return { error: { status: 401, body: { code: 'password', error: '비밀번호가 맞지 않아요.' } } }
  }
  return { key, req, preferred: env.GEMINI_MODEL?.trim() || undefined }
}

/** 한 번에 답 전체를 돌려받는 방식 (검사용) */
export async function handleChat(raw: unknown, env: ChatEnv): Promise<Result> {
  const p = prepareChat(raw, env)
  if ('error' in p) return p.error
  return askGemini(p.key, p.req, p.preferred)
}

/**
 * 답을 글자가 나오는 대로 보내는 스트림 (한 줄에 JSON 하나).
 * {"t":"글자"} 여러 번 → 끝에 {"done":true} 또는 {"code":"…","error":"…"}
 */
export function chatStream(key: string, req: ChatRequest, preferred?: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      const line = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      const out = await askGemini(key, req, preferred, (t) => line({ t }))
      const body = out.body as { code?: string; error?: string }
      line(out.status === 200 ? { done: true } : { code: body.code ?? 'fail', error: body.error ?? '모아가 지금 대답하지 못했어요.' })
      controller.close()
    },
  })
}

/** 서버에 키·비밀번호가 있는지 (대화창을 열 때 '내 키 연결'을 바로 보여줄지 정함) */
export function chatStatus(env: ChatEnv) {
  return { serverKey: !!env.GEMINI_API_KEY?.trim(), password: !!env.CHAT_PASSWORD?.trim() }
}

/**
 * Gemini에 질문. 서버 키로는 서버에서, 사용자가 연결한 자기 키로는 브라우저에서 바로 부름
 * (자기 키는 우리 서버를 거치지 않고 Google로만 감). onText를 주면 만들어지는 대로 글자를 넘겨줌.
 */
export async function askGemini(
  key: string,
  req: { messages?: ChatMessage[]; context?: string },
  preferred?: string,
  onText?: (text: string) => void,
): Promise<Result> {
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
  const payload = (thinking: boolean) => ({
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\n오늘 날짜(한국): ${today}\n\n[내 포트폴리오]\n${context || '(데이터 없음)'}` }] },
    contents: messages,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: MAX_OUTPUT,
      // 답하기 전 '생각'을 가장 낮게 — 모델이 이 설정을 모르면 빼고 다시 보냄
      ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  })

  const models = await pickModels(key, preferred)
  let last: Result = { status: 502, body: { code: 'fail', error: '모아가 지금 대답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.' } }
  for (const model of models) {
    for (const thinking of [true, false]) {
      const res = await fetch(`${API}/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload(thinking)),
      }).catch(() => null)
      if (!res) break
      if (res.ok) {
        const text = await readStream(res, onText)
        if (text) return { status: 200, body: { text, model } }
        last = { status: 502, body: { code: 'empty', error: '모아가 이 질문에는 대답하기 어려워요. 다르게 물어봐 주세요.' } }
        break
      }
      const j = (await res.json().catch(() => ({}))) as GeminiResponse
      // 키가 잘못됐으면 다른 모델로 바꿔도 같음
      if ((res.status === 400 || res.status === 403) && /API key/i.test(j.error?.message ?? '')) {
        return { status: 502, body: { code: 'badkey', error: 'Gemini API 키가 올바르지 않아요.' } }
      }
      // 생각 설정을 모르는 모델이면 같은 모델로 한 번 더
      if (res.status === 400 && thinking) continue
      if (res.status === 429) {
        last = { status: 429, body: { code: 'limit', error: '오늘 무료 사용량을 다 썼거나 너무 자주 물어봤어요. 잠시 뒤 다시 물어봐 주세요.' } }
      }
      // 404(모델 없음)·429(한도)·5xx(혼잡) 등은 다음 모델로
      break
    }
  }
  return last
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  error?: { message?: string }
}

/** 'data: {...}' 줄로 오는 응답을 읽으며 답 글자만 모음 (생각 부분은 뺌) */
async function readStream(res: Response, onText?: (text: string) => void) {
  let text = ''
  const take = (data: string) => {
    try {
      const j = JSON.parse(data) as GeminiResponse
      for (const p of j.candidates?.[0]?.content?.parts ?? []) {
        if (p.thought || typeof p.text !== 'string' || !p.text) continue
        // 첫 글자 앞 공백·줄바꿈은 버림
        const t = text ? p.text : p.text.replace(/^\s+/, '')
        if (!t) continue
        text += t
        onText?.(t)
      }
    } catch {
      // 덜 받은 줄은 무시
    }
  }
  const reader = res.body?.getReader()
  if (!reader) return ''
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (value) buf += dec.decode(value, { stream: true })
    const lines = buf.split(/\r?\n/)
    buf = done ? '' : (lines.pop() ?? '')
    for (const l of lines) if (l.startsWith('data:')) take(l.slice(5).trim())
    if (done) break
  }
  return text.trim()
}

/* ---------- 모델 고르기 ---------- */

/** 모델 목록은 하루 동안 기억 (브라우저에서는 폰에 저장해 앱을 다시 열어도 유지) */
const MODELS_TTL = 24 * 3600_000
const MODELS_KEY = 'etf-planner/gemini-models'
let cached: { key: string; at: number; list: string[] } | null = null

/** 키 전체 대신 끝자리만 표시용으로 저장 */
const keyTag = (key: string) => key.slice(-6)

function loadCache(key: string) {
  if (cached?.key === keyTag(key)) return cached
  try {
    const s = JSON.parse(globalThis.localStorage?.getItem(MODELS_KEY) ?? 'null') as typeof cached
    if (s?.key === keyTag(key) && Array.isArray(s.list)) cached = s
  } catch {
    // 저장소를 못 쓰면 메모리에만
  }
  return cached?.key === keyTag(key) ? cached : null
}

function saveCache(c: NonNullable<typeof cached>) {
  cached = c
  try {
    globalThis.localStorage?.setItem(MODELS_KEY, JSON.stringify(c))
  } catch {
    // 저장소를 못 쓰면 메모리에만
  }
}

/** 키가 쓸 수 있는지 확인 — 모델 목록을 받아봄 */
export async function checkGeminiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/models?pageSize=1`, { headers: { 'x-goog-api-key': key.trim() } })
    if (res.ok) return { ok: true }
    if (res.status === 400 || res.status === 403) return { ok: false, error: '키가 올바르지 않아요. 복사한 키를 다시 확인해 주세요.' }
    if (res.status === 429) return { ok: true }
    return { ok: false, error: '지금은 확인이 어려워요. 잠시 뒤 다시 시도해 주세요.' }
  } catch {
    return { ok: false, error: '인터넷 연결을 확인해 주세요.' }
  }
}

/**
 * 쓸 모델 순서. 이름이 자주 바뀌어서 Google에 쓸 수 있는 모델 목록을 물어보고
 * 정식 Flash(버전 높은 순) → Flash 최신 별칭 → Flash-Lite 순으로 시도합니다.
 */
async function pickModels(key: string, preferred?: string): Promise<string[]> {
  const fallback = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
  let c = loadCache(key)
  if (!c || Date.now() - c.at > MODELS_TTL) {
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
      if (list.length) {
        c = { key: keyTag(key), at: Date.now(), list }
        saveCache(c)
      }
    } catch {
      // 목록을 못 받으면 기억해 둔 목록이나 기본 이름으로 시도
    }
  }
  const list = c?.list ?? fallback
  return [...new Set([...(preferred ? [preferred] : []), ...list])].slice(0, 4)
}

/** 검사용: 기억해 둔 모델 목록 지우기 */
export function clearModelCache() {
  cached = null
}
