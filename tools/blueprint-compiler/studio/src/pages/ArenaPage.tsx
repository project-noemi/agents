import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedBlueprintSummary, ScoreboardRow, StudioApi } from '../api'
import { ARENA_RUNNING, IDLE_ARENA, arenaReducer, endEarly } from '../arena'
import type { ArenaState } from '../arena'
import { ArenaColumns } from '../components/ArenaColumns'
import { ArenaForm } from '../components/ArenaForm'
import type { ArenaFormState } from '../components/ArenaForm'
import { ErrorList } from '../components/ErrorList'
import { Scoreboard } from '../components/Scoreboard'

const describe = (err: unknown) => (err instanceof Error ? err.message : String(err))

// The LLM Arena: one saved blueprint and one prompt, run on every provider at
// once, shown side by side, with a scoreboard over the saved runs.
export function ArenaPage({ api }: { api: StudioApi }) {
  const [blueprints, setBlueprints] = useState<SavedBlueprintSummary[]>([])
  const [form, setForm] = useState<ArenaFormState>({ blueprintId: '', prompt: '' })
  const [arena, setArena] = useState<ArenaState>(IDLE_ARENA)
  const [scores, setScores] = useState<ScoreboardRow[]>([])
  const [notice, setNotice] = useState<string>()
  // Aborts a run still streaming when the user leaves the page.
  const abortRef = useRef<AbortController | null>(null)

  const refreshScores = useCallback(async () => {
    try {
      setScores(await api.scoreboard())
    } catch (err) {
      setNotice(`Could not load the scoreboard: ${describe(err)}`)
    }
  }, [api])

  useEffect(() => {
    let live = true
    api.listBlueprints().then(
      (items) => live && setBlueprints(items),
      (err) => live && setNotice(`Could not load saved blueprints: ${describe(err)}`),
    )
    api.scoreboard().then(
      (rows) => live && setScores(rows),
      (err) => live && setNotice(`Could not load the scoreboard: ${describe(err)}`),
    )
    return () => {
      live = false
      abortRef.current?.abort()
    }
  }, [api])

  const onRun = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setNotice(undefined)
    setArena(ARENA_RUNNING)
    try {
      for await (const event of api.arena(form, controller.signal)) setArena((s) => arenaReducer(s, event))
      // A stream that closes without `end` or `error` was cut short.
      setArena((s) => (s.status === 'running' ? endEarly(s) : s))
    } catch (err) {
      setArena((s) => endEarly(s, describe(err)))
    } finally {
      abortRef.current = null
      // The server saves the run before it sends `end`.
      void refreshScores()
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-page-title">LLM Arena</h1>

      {notice ? (
        <p role="status" className="alert">
          {notice}
        </p>
      ) : null}

      <section className="card" aria-labelledby="arena-run">
        <h2 id="arena-run" className="text-section">
          Run
        </h2>
        <ArenaForm
          form={form}
          onChange={setForm}
          blueprints={blueprints}
          running={arena.status === 'running'}
          onRun={onRun}
        />
      </section>

      {arena.message ? (
        <p role="alert" className="alert alert-error">
          {arena.message}
        </p>
      ) : null}
      {arena.failure ? <ErrorList stage={arena.failure.stage} errors={arena.failure.errors} /> : null}

      {arena.columns.length ? (
        <section className="space-y-2" aria-labelledby="arena-results">
          <h2 id="arena-results" className="text-section">
            Results{arena.blueprint ? <> for <code>{arena.blueprint}</code></> : null}
          </h2>
          <ArenaColumns columns={arena.columns} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="arena-scoreboard">
        <h2 id="arena-scoreboard" className="text-section">
          Scoreboard
        </h2>
        <Scoreboard rows={scores} onRefresh={refreshScores} />
      </section>
    </div>
  )
}
