import { describe, expect, it } from 'vitest'
import type { ArenaEvent } from './api'
import { ARENA_RUNNING, arenaReducer, endEarly, formatCost, formatDuration, rankRows } from './arena'
import { row, usage } from './test/fake-api'

const play = (events: ArenaEvent[]) => events.reduce(arenaReducer, ARENA_RUNNING)

describe('arenaReducer', () => {
  it('opens one waiting column per announced provider, in order', () => {
    const s = play([{ type: 'arena', id: 'r1', blueprint: 'coding/architect', providers: ['mock', 'gemini', 'xai'] }])
    expect(s.status).toBe('running')
    expect(s.blueprint).toBe('coding/architect')
    expect(s.columns.map((c) => [c.provider, c.status])).toEqual([
      ['mock', 'waiting'],
      ['gemini', 'waiting'],
      ['xai', 'waiting'],
    ])
  })

  it('routes interleaved tokens to the right column', () => {
    const s = play([
      { type: 'arena', id: 'r1', blueprint: 'b', providers: ['gemini', 'xai'] },
      { type: 'start', provider: 'gemini', model: 'gemini-3.8-flash' },
      { type: 'token', provider: 'gemini', text: 'Hel' },
      { type: 'token', provider: 'xai', text: 'Bon' },
      { type: 'token', provider: 'gemini', text: 'lo' },
      { type: 'token', provider: 'xai', text: 'jour' },
    ])
    expect(s.columns[0]).toMatchObject({ text: 'Hello', model: 'gemini-3.8-flash', status: 'streaming' })
    expect(s.columns[1]).toMatchObject({ text: 'Bonjour', status: 'streaming' })
  })

  it('records a failed provider without touching the others', () => {
    const s = play([
      { type: 'arena', id: 'r1', blueprint: 'b', providers: ['gemini', 'xai'] },
      { type: 'token', provider: 'gemini', text: 'ok' },
      { type: 'failed', provider: 'xai', stage: 'provider', errors: [{ code: 'TIMEOUT', message: 'timed out' }] },
      { type: 'done', provider: 'gemini', usage: usage() },
      { type: 'end', id: 'r1' },
    ])
    expect(s.status).toBe('done')
    expect(s.columns[0]).toMatchObject({ status: 'done', usage: usage() })
    expect(s.columns[1]).toMatchObject({ status: 'failed', failure: { stage: 'provider' } })
  })

  it('adds a column for a provider the server did not announce', () => {
    const s = play([
      { type: 'arena', id: 'r1', blueprint: 'b', providers: ['mock'] },
      { type: 'token', provider: 'gemini', text: 'hi' },
    ])
    expect(s.columns.map((c) => c.provider)).toEqual(['mock', 'gemini'])
  })

  it('marks the whole run failed on an error event', () => {
    const s = play([{ type: 'error', stage: 'validate', errors: [{ code: 'MISSING_REFUSAL', message: 'x' }] }])
    expect(s.status).toBe('error')
    expect(s.failure?.errors[0].code).toBe('MISSING_REFUSAL')
  })
})

describe('endEarly', () => {
  const s = play([
    { type: 'arena', id: 'r1', blueprint: 'b', providers: ['mock', 'gemini', 'xai'] },
    { type: 'done', provider: 'mock', usage: usage() },
    { type: 'token', provider: 'gemini', text: 'par' },
  ])

  it('stops unfinished columns and leaves finished ones', () => {
    expect(endEarly(s).columns.map((c) => c.status)).toEqual(['done', 'stopped', 'stopped'])
  })

  it('keeps the message when the request failed', () => {
    const failed = endEarly(s, 'HTTP 429')
    expect(failed.status).toBe('error')
    expect(failed.message).toBe('HTTP 429')
  })
})

describe('formatting', () => {
  it('keeps four decimals for costs under a cent', () => {
    expect([formatCost(0), formatCost(0.0021), formatCost(0.042)]).toEqual(['$0.00', '$0.0021', '$0.04'])
  })

  it('switches to seconds from 1000 ms', () => {
    expect([formatDuration(640.4), formatDuration(1500)]).toEqual(['640 ms', '1.5 s'])
  })
})

describe('rankRows', () => {
  it('ranks by success rate, then by average latency', () => {
    const ranked = rankRows([
      row({ provider: 'xai', ok: 2, failed: 2 }),
      row({ provider: 'mock', avgLatencyMs: 900 }),
      row({ provider: 'gemini', avgLatencyMs: 400 }),
    ])
    expect(ranked.map((r) => r.provider)).toEqual(['gemini', 'mock', 'xai'])
  })
})
