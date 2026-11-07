import type { ScoreboardRow } from '../api'
import { formatCost, formatDuration, rankRows } from '../arena'
import { Icon } from './Icon'

type Props = { rows: ScoreboardRow[]; onRefresh: () => void }

// Totals per provider over every saved Arena run, best first.
export function Scoreboard({ rows, onRefresh }: Props) {
  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-sm" onClick={onRefresh}>
        <Icon name="refresh" />
        Refresh
      </button>
      {rows.length === 0 ? (
        <p>No Arena runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table" aria-label="Scoreboard">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Provider</th>
                <th>Runs</th>
                <th>Succeeded</th>
                <th>Failed</th>
                <th>Avg latency</th>
                <th>Tokens in / out</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {rankRows(rows).map((r, i) => (
                <tr key={r.provider}>
                  <td>{i + 1}</td>
                  <td>{r.provider}</td>
                  <td>{r.runs}</td>
                  <td>{r.ok}</td>
                  <td>{r.failed}</td>
                  <td>{r.avgLatencyMs === null ? '—' : formatDuration(r.avgLatencyMs)}</td>
                  <td>
                    {r.inputTokens} / {r.outputTokens}
                  </td>
                  <td>{formatCost(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
