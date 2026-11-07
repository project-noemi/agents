import { vi } from 'vitest'
import type { ArenaEvent, ScoreboardRow, StudioApi, Usage } from '../api'

// A StudioApi whose every call is a spy, for component tests. Arena streams are
// scripted per test with `streamOf`.
export function fakeApi(overrides: Partial<StudioApi> = {}): StudioApi {
  return {
    validate: vi.fn(),
    run: vi.fn(),
    listBlueprints: vi.fn(async () => [
      { id: 'a1', name: 'architect', updatedAt: '2026-11-01T10:00:00.000Z' },
      { id: 'b2', name: 'reviewer', updatedAt: '2026-11-02T10:00:00.000Z' },
    ]),
    getBlueprint: vi.fn(),
    saveBlueprint: vi.fn(),
    renameBlueprint: vi.fn(),
    deleteBlueprint: vi.fn(),
    listRuns: vi.fn(async () => []),
    arena: vi.fn(() => streamOf([])),
    scoreboard: vi.fn(async (): Promise<ScoreboardRow[]> => []),
    ...overrides,
  }
}

export async function* streamOf(events: ArenaEvent[]): AsyncGenerator<ArenaEvent> {
  for (const e of events) {
    await Promise.resolve()
    yield e
  }
}

export const usage = (over: Partial<Usage> = {}): Usage => ({
  inputTokens: 1200,
  outputTokens: 340,
  latencyMs: 850,
  costUsd: 0.0021,
  ...over,
})

export const row = (over: Partial<ScoreboardRow> & { provider: string }): ScoreboardRow => ({
  runs: 4,
  ok: 4,
  failed: 0,
  avgLatencyMs: 900,
  inputTokens: 4800,
  outputTokens: 1200,
  costUsd: 0.01,
  ...over,
})
