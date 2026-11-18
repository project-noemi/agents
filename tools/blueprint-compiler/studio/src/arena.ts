// Arena page state: one column per provider, filled from the Arena stream.
import type { ArenaEvent, CompileError, ScoreboardRow, Stage, Usage } from './api'

export type ColumnStatus = 'waiting' | 'streaming' | 'done' | 'failed' | 'stopped'

export type ArenaColumn = {
  provider: string
  status: ColumnStatus
  model?: string
  text: string
  usage?: Usage
  failure?: { stage: Stage; errors: CompileError[] }
}

export type ArenaState = {
  status: 'idle' | 'running' | 'done' | 'error'
  blueprint?: string
  columns: ArenaColumn[]
  // The whole run failed before any provider ran.
  failure?: { stage: Stage; errors: CompileError[] }
  // The request itself failed (network error or a non-2xx response).
  message?: string
}

export const IDLE_ARENA: ArenaState = { status: 'idle', columns: [] }

export const ARENA_RUNNING: ArenaState = { status: 'running', columns: [] }

const emptyColumn = (provider: string): ArenaColumn => ({ provider, status: 'waiting', text: '' })

// Applies one change to the column for `provider`, adding the column if the
// server names a provider it did not announce.
function withColumn(state: ArenaState, provider: string, change: (c: ArenaColumn) => ArenaColumn): ArenaState {
  const known = state.columns.some((c) => c.provider === provider)
  const columns = known ? state.columns : [...state.columns, emptyColumn(provider)]
  return { ...state, columns: columns.map((c) => (c.provider === provider ? change(c) : c)) }
}

export function arenaReducer(state: ArenaState, event: ArenaEvent): ArenaState {
  switch (event.type) {
    case 'arena':
      return { ...state, status: 'running', blueprint: event.blueprint, columns: event.providers.map(emptyColumn) }
    case 'start':
      return withColumn(state, event.provider, (c) => ({ ...c, status: 'streaming', model: event.model ?? c.model }))
    case 'token':
      return withColumn(state, event.provider, (c) => ({ ...c, status: 'streaming', text: c.text + event.text }))
    case 'done':
      return withColumn(state, event.provider, (c) => ({
        ...c,
        status: 'done',
        model: event.model ?? c.model,
        usage: event.usage,
      }))
    case 'failed':
      return withColumn(state, event.provider, (c) => ({
        ...c,
        status: 'failed',
        failure: { stage: event.stage, errors: event.errors },
      }))
    case 'error':
      return { ...state, status: 'error', failure: { stage: event.stage, errors: event.errors } }
    case 'end':
      return { ...state, status: 'done' }
  }
}

// The stream ended without `end` (closed early or threw): unfinished columns stop.
export function endEarly(state: ArenaState, message?: string): ArenaState {
  return {
    ...state,
    status: message ? 'error' : 'done',
    message,
    columns: state.columns.map((c) =>
      c.status === 'waiting' || c.status === 'streaming' ? { ...c, status: 'stopped' } : c,
    ),
  }
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`)

// Model calls cost fractions of a cent, so amounts under a cent keep four decimals.
export const formatCost = (usd: number) => `$${usd.toFixed(usd > 0 && usd < 0.01 ? 4 : 2)}`

// Scoreboard order, best first: highest success rate, then lowest average latency.
export function rankRows(rows: ScoreboardRow[]): ScoreboardRow[] {
  const rate = (r: ScoreboardRow) => (r.runs ? r.ok / r.runs : 0)
  return [...rows].sort(
    (a, b) =>
      rate(b) - rate(a) ||
      (a.avgLatencyMs ?? Infinity) - (b.avgLatencyMs ?? Infinity) ||
      a.provider.localeCompare(b.provider),
  )
}
