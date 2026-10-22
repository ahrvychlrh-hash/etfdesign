// 모아 대화(Gemini) 서버 함수 검사 — 실제 Google 서버 대신 가짜 응답으로 확인
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { askGemini, chatStatus, chatStream, checkGeminiKey, clearModelCache, handleChat } from '../server/chat.ts'

const ask = { messages: [{ role: 'user', text: '내 포트폴리오 어때요?' }], context: '- 미국 60%' }

beforeEach(() => clearModelCache())

/** Gemini 스트리밍 응답처럼 'data: {...}' 줄로 만든 본문 */
const sse = (...chunks) =>
  chunks.map((parts) => `data: ${JSON.stringify({ candidates: [{ content: { parts } }] })}\r\n\r\n`).join('')

/** 가짜 fetch: handlers(url, init) → { status, body(객체) | sse(문자열) } */
function fakeFetch(handlers) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    const h = handlers(String(url), init)
    const body = h.sse ?? JSON.stringify(h.body ?? {})
    return new Response(body, { status: h.status ?? 200 })
  }
  return calls
}

const MODELS = {
  models: [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ],
}
const isGen = (url) => url.includes(':streamGenerateContent')

test('키가 없으면 nokey', async () => {
  const r = await handleChat(ask, {})
  assert.equal(r.status, 503)
  assert.equal(r.body.code, 'nokey')
})

test('비밀번호를 정해 두면 틀릴 때 막음', async () => {
  const r = await handleChat({ ...ask, password: 'x' }, { GEMINI_API_KEY: 'k', CHAT_PASSWORD: 'secret' })
  assert.equal(r.status, 401)
  assert.equal(r.body.code, 'password')
})

test('가장 최신 Flash 모델로 묻고, 생각 부분은 빼고 답만 이어 붙임', async () => {
  const calls = fakeFetch((url) =>
    isGen(url) ? { sse: sse([{ text: '생각 중', thought: true }], [{ text: '좋아' }], [{ text: '요!' }]) } : { body: MODELS },
  )
  const got = []
  const r = await askGemini('k', ask, undefined, (t) => got.push(t))
  assert.equal(r.status, 200)
  assert.equal(r.body.text, '좋아요!')
  assert.deepEqual(got, ['좋아', '요!'])
  const gen = calls.find((c) => isGen(c.url))
  assert.ok(gen.url.includes('/models/gemini-3.5-flash:streamGenerateContent?alt=sse'))
  // 키는 주소가 아니라 헤더로
  assert.equal(gen.init.headers['x-goog-api-key'], 'k')
  const sent = JSON.parse(gen.init.body)
  assert.ok(sent.systemInstruction.parts[0].text.includes('- 미국 60%'))
  assert.deepEqual(sent.contents, [{ role: 'user', parts: [{ text: '내 포트폴리오 어때요?' }] }])
  // 빠르게: 생각은 가장 낮게, 답은 짧게
  assert.equal(sent.generationConfig.thinkingConfig.thinkingLevel, 'low')
  assert.ok(sent.generationConfig.maxOutputTokens <= 1024)
})

test('생각 설정을 모르는 모델이면 설정을 빼고 같은 모델로 다시 물어봄', async () => {
  const calls = fakeFetch((url, init) => {
    if (!isGen(url)) return { body: MODELS }
    const cfg = JSON.parse(init.body).generationConfig
    return cfg.thinkingConfig ? { status: 400, body: { error: { message: 'Unknown field thinkingLevel' } } } : { sse: sse([{ text: '답' }]) }
  })
  const r = await askGemini('k', ask)
  assert.equal(r.body.text, '답')
  const gens = calls.filter((c) => isGen(c.url))
  assert.equal(gens.length, 2)
  assert.equal(gens[0].url, gens[1].url)
})

test('한도 초과(429)면 다음 모델로 넘어감', async () => {
  const calls = fakeFetch((url) => {
    if (url.includes('gemini-3.5-flash:')) return { status: 429, body: { error: { message: 'quota' } } }
    if (isGen(url)) return { sse: sse([{ text: '두 번째 모델 답' }]) }
    return { body: MODELS }
  })
  const r = await askGemini('k', ask)
  assert.equal(r.body.text, '두 번째 모델 답')
  assert.equal(calls.filter((c) => isGen(c.url)).length, 2)
})

test('모든 모델이 한도 초과면 limit 안내', async () => {
  fakeFetch((url) => (isGen(url) ? { status: 429, body: {} } : { body: MODELS }))
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.status, 429)
  assert.equal(r.body.code, 'limit')
})

test('키가 잘못됐으면 바로 badkey', async () => {
  fakeFetch((url) => (isGen(url) ? { status: 400, body: { error: { message: 'API key not valid' } } } : { body: MODELS }))
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.body.code, 'badkey')
})

test('모델 목록은 한 번 받으면 기억해서 다음 질문엔 바로 물어봄', async () => {
  const calls = fakeFetch((url) => (isGen(url) ? { sse: sse([{ text: 'ok' }]) } : { body: MODELS }))
  await askGemini('k', ask)
  await askGemini('k', ask)
  assert.equal(calls.filter((c) => c.url.includes('/models?')).length, 1)
})

test('모아 말로 시작하는 대화는 앞을 잘라 사용자 말부터 보냄', async () => {
  const calls = fakeFetch((url) => (isGen(url) ? { sse: sse([{ text: 'ok' }]) } : { body: MODELS }))
  await askGemini('k', {
    messages: [
      { role: 'model', text: '안녕' },
      { role: 'user', text: '질문' },
    ],
  })
  const sent = JSON.parse(calls.find((c) => isGen(c.url)).init.body)
  assert.equal(sent.contents[0].role, 'user')
})

test('서버 스트림: 글자 줄들 뒤에 done', async () => {
  fakeFetch((url) => (isGen(url) ? { sse: sse([{ text: '안녕' }], [{ text: '하세요' }]) } : { body: MODELS }))
  const text = await new Response(chatStream('k', ask)).text()
  const lines = text.trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(lines, [{ t: '안녕' }, { t: '하세요' }, { done: true }])
})

test('서버 스트림: 실패하면 마지막 줄에 오류 코드', async () => {
  fakeFetch((url) => (isGen(url) ? { status: 429, body: {} } : { body: MODELS }))
  const text = await new Response(chatStream('k', ask)).text()
  const last = JSON.parse(text.trim().split('\n').pop())
  assert.equal(last.code, 'limit')
})

test('서버 상태: 키·비밀번호가 있는지만 알려줌 (키 값은 안 보냄)', () => {
  assert.deepEqual(chatStatus({ GEMINI_API_KEY: 'secret' }), { serverKey: true, password: false })
  assert.deepEqual(chatStatus({}), { serverKey: false, password: false })
})

test('내 키 연결: 올바른 키면 ok, 잘못된 키면 안내', async () => {
  fakeFetch(() => ({ body: MODELS }))
  assert.equal((await checkGeminiKey('good')).ok, true)
  fakeFetch(() => ({ status: 400, body: { error: { message: 'API key not valid' } } }))
  const bad = await checkGeminiKey('bad')
  assert.equal(bad.ok, false)
  assert.ok(bad.error.includes('올바르지'))
})

test('내 키로 바로 물어볼 때는 비밀번호 없이 그 키로 보냄', async () => {
  const calls = fakeFetch((url) => (isGen(url) ? { sse: sse([{ text: '내 키 답' }]) } : { body: MODELS }))
  const r = await askGemini('my-key', ask)
  assert.equal(r.body.text, '내 키 답')
  assert.ok(calls.every((c) => c.init?.headers?.['x-goog-api-key'] === 'my-key'))
})
