import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArenaEvent } from './types'
import { httpApi } from './http'
import { mockApi } from './mock'

const collect = async (events: AsyncIterable<ArenaEvent>) => {
  const out: ArenaEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

describe('mock Arena backend', () => {
  it('answers for mock, records the live providers as failed, and builds the scoreboard', async () => {
    const [sample] = await mockApi.listBlueprints()
    const events = await collect(mockApi.arena({ blueprintId: sample.id, prompt: 'hi' }))

    expect(events[0]).toMatchObject({ type: 'arena', providers: ['mock', 'gemini', 'xai'] })
    expect(events.at(-1)).toMatchObject({ type: 'end' })
    expect(events.filter((e) => e.type === 'failed').map((e) => 'provider' in e && e.provider)).toEqual(['gemini', 'xai'])
    expect(events.find((e) => e.type === 'done')).toMatchObject({ provider: 'mock' })

    const board = await mockApi.scoreboard()
    expect(board.find((r) => r.provider === 'xai')).toMatchObject({ runs: 1, ok: 0, failed: 1, avgLatencyMs: null })
    expect(board.find((r) => r.provider === 'mock')).toMatchObject({ runs: 1, ok: 1, failed: 0 })
  })

  it('fails the whole run for an unknown blueprint', async () => {
    const events = await collect(mockApi.arena({ blueprintId: 'nope', prompt: 'hi' }))
    expect(events).toEqual([{ type: 'error', stage: 'load', errors: [expect.objectContaining({ code: 'LOAD' })] }])
  })
})

describe('http Arena adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to /api/arena and parses server-sent events split across chunks', async () => {
    const wire = [
      'data: {"type":"arena","id":"r1","blueprint":"b","providers":["gemini"]}\n\n',
      'data: {"type":"token","provider":"gemini",',
      '"text":"hi"}\n\ndata: {"type":"end","id":"r1"}\n\n',
    ]
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of wire) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    })
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const events = await collect(httpApi.arena({ blueprintId: 'a1', prompt: 'hi' }))
    expect(events.map((e) => e.type)).toEqual(['arena', 'token', 'end'])

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/arena')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ blueprintId: 'a1', prompt: 'hi' })
  })

  it('turns a non-2xx response into an error with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Not authenticated.' }, { status: 401 })))
    await expect(collect(httpApi.arena({ blueprintId: 'a1', prompt: 'hi' }))).rejects.toThrow('Not authenticated.')
  })
})
