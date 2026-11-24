import type { ArenaColumn, ColumnStatus } from '../arena'
import { formatCost, formatDuration } from '../arena'
import { ErrorList } from './ErrorList'
import { StatusChip } from './StatusChip'
import type { Tone } from './StatusChip'

const TONE: Record<ColumnStatus, Tone> = {
  waiting: 'secondary',
  streaming: 'info',
  done: 'success',
  failed: 'error',
  stopped: 'warning',
}

function ProviderColumn({ column }: { column: ArenaColumn }) {
  const usage = column.usage
  return (
    <article className="card space-y-2" aria-label={`${column.provider} result`}>
      <header className="flex items-center gap-2">
        <h3 className="text-section">{column.provider}</h3>
        <StatusChip tone={TONE[column.status]}>{column.status}</StatusChip>
      </header>
      {column.model ? <p className="text-caption">{column.model}</p> : null}

      <pre aria-live="polite" className="panel min-h-24 whitespace-pre-wrap">
        {column.text}
      </pre>

      {column.failure ? <ErrorList stage={column.failure.stage} errors={column.failure.errors} /> : null}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 text-body-sm">
        <dt>Latency</dt>
        <dd>{usage ? formatDuration(usage.latencyMs) : '—'}</dd>
        <dt>Tokens in / out</dt>
        <dd>{usage ? `${usage.inputTokens} / ${usage.outputTokens}` : '—'}</dd>
        <dt>Cost</dt>
        <dd>{usage ? formatCost(usage.costUsd) : '—'}</dd>
      </dl>
    </article>
  )
}

// One column per provider, side by side from 1280px; below that (mobile, per the
// style guide) they stack.
export function ArenaColumns({ columns }: { columns: ArenaColumn[] }) {
  return (
    <div className="grid gap-6 lg:auto-cols-fr lg:grid-flow-col">
      {columns.map((c) => (
        <ProviderColumn key={c.provider} column={c} />
      ))}
    </div>
  )
}
