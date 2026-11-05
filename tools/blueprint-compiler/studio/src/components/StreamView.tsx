import type { RunState } from '../state'
import { ErrorList } from './ErrorList'

// Live output of a run, plus who answered and what it cost once it finishes.
export function StreamView({ run }: { run: RunState }) {
  if (run.status === 'idle') return <p>Run a blueprint to see its output here.</p>

  return (
    <div className="space-y-2">
      <p>
        Status: <strong>{run.status}</strong>
        {run.start ? (
          <>
            {' '}
            · provider {run.start.provider} · runtime {run.start.runtime}
          </>
        ) : null}
      </p>

      <pre aria-live="polite" className="min-h-24 whitespace-pre-wrap border p-2">
        {run.text}
      </pre>

      {run.done ? (
        <p className="text-sm">
          Answered by {run.done.provider}
          {run.done.model ? ` (${run.done.model})` : ''}
          {run.done.usage
            ? ` · ${run.done.usage.inputTokens} in / ${run.done.usage.outputTokens} out tokens · ${run.done.usage.latencyMs} ms`
            : ''}
          {run.done.fallbacks?.length
            ? ` · fell back from ${run.done.fallbacks.map((f) => `${f.provider} (${f.reason})`).join(', ')}`
            : ''}
        </p>
      ) : null}

      {run.failure ? <ErrorList stage={run.failure.stage} errors={run.failure.errors} /> : null}
      {run.message ? <p role="alert">{run.message}</p> : null}
    </div>
  )
}
