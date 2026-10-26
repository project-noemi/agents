import type { RunRecord, SavedBlueprintSummary } from '../api'

type Props = {
  runs: RunRecord[]
  blueprints: SavedBlueprintSummary[]
  onRefresh: () => void
}

const duration = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

function outcomeText(r: RunRecord): string {
  if (r.outcome === 'error') {
    const where = r.stage ? ` at ${r.stage}` : ''
    return `error${where}: ${(r.errorCodes ?? []).join(', ') || 'unknown'}`
  }
  if (r.outcome === 'fallback') {
    return `ok, fell back from ${r.fallbacks.map((f) => `${f.provider} (${f.reason})`).join(', ')}`
  }
  return 'ok'
}

// Past runs, newest first. A row shows the saved blueprint's current name when it
// still exists, so a rename shows up here too.
export function RunTable({ runs, blueprints, onRefresh }: Props) {
  const names = new Map(blueprints.map((b) => [b.id, b.name]))

  return (
    <div className="space-y-2">
      <button type="button" className="border px-2 py-1" onClick={onRefresh}>
        Refresh
      </button>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="p-1">When</th>
              <th className="p-1">Blueprint</th>
              <th className="p-1">Provider</th>
              <th className="p-1">Runtime</th>
              <th className="p-1">Time</th>
              <th className="p-1">Tokens in / out</th>
              <th className="p-1">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-1">{new Date(r.at).toLocaleString()}</td>
                <td className="p-1">{(r.blueprintId && names.get(r.blueprintId)) || r.blueprint}</td>
                <td className="p-1">
                  {r.provider ?? '—'}
                  {r.model ? <span className="block text-sm">{r.model}</span> : null}
                </td>
                <td className="p-1">{r.runtime ?? '—'}</td>
                <td className="p-1">{duration(r.durationMs)}</td>
                <td className="p-1">
                  {r.inputTokens} / {r.outputTokens}
                </td>
                <td className="p-1">{outcomeText(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
