// 모아 대화(Gemini) 서버 함수 검사 — 실제 Google 서버 대신 가짜 응답으로 확인
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleChat } from '../server/chat.ts'

const ask = { messages: [{ role: 'user', text: '내 포트폴리오 어때요?' }], context: '- 미국 60%' }

/** 가짜 fetch: 모델 목록과 generateContent 응답을 차례로 돌려줌 */
function fakeFetch(handlers) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    const h = handlers(String(url), init)
    return new Response(JSON.stringify(h.body), { status: h.status ?? 200 })
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

test('가장 최신 Flash 모델로 묻고, 생각 부분은 빼고 답만 돌려줌', async () => {
  const calls = fakeFetch((url) =>
    url.includes(':generateContent')
      ? { body: { candidates: [{ content: { parts: [{ text: '생각 중', thought: true }, { text: '좋아요!' }] } }] } }
      : { body: MODELS },
  )
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.status, 200)
  assert.equal(r.body.text, '좋아요!')
  const gen = calls.find((c) => c.url.includes(':generateContent'))
  assert.ok(gen.url.includes('/models/gemini-3.5-flash:generateContent'))
  // 키는 주소가 아니라 헤더로
  assert.equal(gen.init.headers['x-goog-api-key'], 'k')
  const sent = JSON.parse(gen.init.body)
  assert.ok(sent.systemInstruction.parts[0].text.includes('- 미국 60%'))
  assert.deepEqual(sent.contents, [{ role: 'user', parts: [{ text: '내 포트폴리오 어때요?' }] }])
})

test('한도 초과(429)면 다음 모델로 넘어감', async () => {
  const calls = fakeFetch((url) => {
    if (url.includes('gemini-3.5-flash:generateContent')) return { status: 429, body: { error: { message: 'quota' } } }
    if (url.includes(':generateContent')) return { body: { candidates: [{ content: { parts: [{ text: '두 번째 모델 답' }] } }] } }
    return { body: MODELS }
  })
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.body.text, '두 번째 모델 답')
  assert.equal(calls.filter((c) => c.url.includes(':generateContent')).length, 2)
})

test('모든 모델이 한도 초과면 limit 안내', async () => {
  fakeFetch((url) => (url.includes(':generateContent') ? { status: 429, body: {} } : { body: MODELS }))
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.status, 429)
  assert.equal(r.body.code, 'limit')
})

test('키가 잘못됐으면 바로 badkey', async () => {
  fakeFetch((url) =>
    url.includes(':generateContent') ? { status: 400, body: { error: { message: 'API key not valid' } } } : { body: MODELS },
  )
  const r = await handleChat(ask, { GEMINI_API_KEY: 'k' })
  assert.equal(r.body.code, 'badkey')
})

test('모아 말로 시작하는 대화는 앞을 잘라 사용자 말부터 보냄', async () => {
  const calls = fakeFetch((url) =>
    url.includes(':generateContent') ? { body: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } } : { body: MODELS },
  )
  await handleChat(
    {
      messages: [
        { role: 'model', text: '안녕' },
        { role: 'user', text: '질문' },
      ],
    },
    { GEMINI_API_KEY: 'k' },
  )
  const sent = JSON.parse(calls.find((c) => c.url.includes(':generateContent')).init.body)
  assert.equal(sent.contents[0].role, 'user')
})
