import { useCallback, useEffect, useRef, useState } from 'react'
import { api, backend } from './api'
import type { SavedBlueprintSummary, ValidateResult } from './api'
import { BlueprintForm } from './components/BlueprintForm'
import { BlueprintTable } from './components/BlueprintTable'
import { StreamView } from './components/StreamView'
import { ValidationPanel } from './components/ValidationPanel'
import { EMPTY_FORM, IDLE_RUN, toInput } from './state'
import type { FormState, RunState } from './state'

const describe = (err: unknown) => (err instanceof Error ? err.message : String(err))

function App() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saved, setSaved] = useState<SavedBlueprintSummary[]>([])
  const [validation, setValidation] = useState<ValidateResult>()
  const [run, setRun] = useState<RunState>(IDLE_RUN)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const abortRef = useRef<AbortController | null>(null)

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await api.listBlueprints())
    } catch (err) {
      setNotice(`Could not load saved blueprints: ${describe(err)}`)
    }
  }, [])

  // Initial load of the saved list.
  useEffect(() => {
    let live = true
    api.listBlueprints().then(
      (items) => live && setSaved(items),
      (err) => live && setNotice(`Could not load saved blueprints: ${describe(err)}`),
    )
    return () => {
      live = false
    }
  }, [])

  // A change to the blueprint source makes the last validation stale.
  const onChange = (next: FormState) => {
    if (JSON.stringify(toInput(next)) !== JSON.stringify(toInput(form))) setValidation(undefined)
    setForm(next)
  }

  // Runs an API call with the buttons disabled and failures shown as a notice.
  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(undefined)
    try {
      await action()
    } catch (err) {
      setNotice(describe(err))
    } finally {
      setBusy(false)
    }
  }

  const onValidate = () =>
    withBusy(async () => {
      setValidation(await api.validate(toInput(form)))
    })

  const onSave = () =>
    withBusy(async () => {
      const result = await api.saveBlueprint({ id: form.id, name: form.name.trim(), markdown: form.markdown })
      setForm({ ...form, id: result.id, name: result.name })
      setNotice(`Saved "${result.name}".`)
      await refreshSaved()
    })

  const onOpen = (id: string) =>
    withBusy(async () => {
      const b = await api.getBlueprint(id)
      setForm({ ...form, id: b.id, name: b.name, markdown: b.markdown, sourceKind: 'text' })
      setValidation(undefined)
    })

  const onDelete = (id: string) =>
    withBusy(async () => {
      await api.deleteBlueprint(id)
      if (form.id === id) setForm({ ...form, id: undefined })
      await refreshSaved()
    })

  const onNew = () => {
    setForm({ ...EMPTY_FORM, provider: form.provider, runtime: form.runtime })
    setValidation(undefined)
    setRun(IDLE_RUN)
    setNotice(undefined)
  }

  const onRun = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setNotice(undefined)
    setRun({ status: 'running', text: '' })
    try {
      const events = api.run(
        { input: toInput(form), prompt: form.prompt, provider: form.provider, runtime: form.runtime },
        controller.signal,
      )
      for await (const event of events) {
        if (event.type === 'start') setRun((r) => ({ ...r, start: event }))
        else if (event.type === 'token') setRun((r) => ({ ...r, text: r.text + event.text }))
        else if (event.type === 'done') setRun((r) => ({ ...r, status: 'done', done: event }))
        else setRun((r) => ({ ...r, status: 'error', failure: event }))
      }
      if (controller.signal.aborted) setRun((r) => ({ ...r, status: 'stopped' }))
    } catch (err) {
      if (controller.signal.aborted) setRun((r) => ({ ...r, status: 'stopped' }))
      else setRun((r) => ({ ...r, status: 'error', message: describe(err) }))
    } finally {
      abortRef.current = null
    }
  }

  const onStop = () => abortRef.current?.abort()

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold">NoéMI Studio</h1>
        <p className="text-sm">Backend: {backend === 'mock' ? 'offline mock (no server)' : 'Studio server'}</p>
      </header>

      {notice ? (
        <p role="status" className="border p-2">
          {notice}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Saved blueprints</h2>
        <BlueprintTable items={saved} selectedId={form.id} onOpen={onOpen} onDelete={onDelete} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Blueprint</h2>
        <BlueprintForm
          form={form}
          onChange={onChange}
          running={run.status === 'running'}
          busy={busy}
          onValidate={onValidate}
          onRun={onRun}
          onStop={onStop}
          onSave={onSave}
          onNew={onNew}
        />
        {validation ? <ValidationPanel result={validation} /> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Output</h2>
        <StreamView run={run} />
      </section>
    </main>
  )
}

export default App
