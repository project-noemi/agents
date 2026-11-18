import type { RunRecord, SavedBlueprintSummary } from '../api'
import { Icon } from './Icon'
import { StatusChip } from './StatusChip'

type Props = {
  runs: RunRecord[]
  blueprints: SavedBlueprintSummary[]
  onRefresh: () => void
}

const duration = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

const OUTCOME_TONE = { ok: 'success', fallback: 'warning', error: 'error' } as const

// The text after the outcome chip: what failed, or who it fell back from.
function outcomeDetail(r: RunRecord): string {
  if (r.outcome === 'error') {
    const where = r.stage ? ` at ${r.stage}` : ''
    return `${where}: ${(r.errorCodes ?? []).join(', ') || 'unknown'}`
  }
  if (r.outcome === 'fallback') {
    return ` from ${r.fallbacks.map((f) => `${f.provider} (${f.reason})`).join(', ')}`
  }
  return ''
}

// Past runs, newest first. A row shows the saved blueprint's current name when it
// still exists, so a rename shows up here too.
export function RunTable({ runs, blueprints, onRefresh }: Props) {
  const names = new Map(blueprints.map((b) => [b.id, b.name]))

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-sm" onClick={onRefresh}>
        <Icon name="refresh" />
        Refresh
      </button>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Blueprint</th>
              <th>Provider</th>
              <th>Runtime</th>
              <th>Time</th>
              <th>Tokens in / out</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="align-top">
                <td>{new Date(r.at).toLocaleString()}</td>
                <td>{(r.blueprintId && names.get(r.blueprintId)) || r.blueprint}</td>
                <td>
                  {r.provider ?? '—'}
                  {r.model ? <span className="block text-body-sm">{r.model}</span> : null}
                </td>
                <td>{r.runtime ?? '—'}</td>
                <td>{duration(r.durationMs)}</td>
                <td>
                  {r.inputTokens} / {r.outputTokens}
                </td>
                <td>
                  <StatusChip tone={OUTCOME_TONE[r.outcome]}>{r.outcome}</StatusChip>
                  {outcomeDetail(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
