import type { Provider, Runtime } from '../api'
import { PROVIDERS, RUNTIMES } from '../api'
import type { FormState, SourceKind } from '../state'

type Props = {
  form: FormState
  onChange: (form: FormState) => void
  running: boolean
  busy: boolean
  onValidate: () => void
  onRun: () => void
  onStop: () => void
  onSave: () => void
  onNew: () => void
}

const SOURCE_LABELS: Record<SourceKind, string> = {
  text: 'Write it here',
  url: 'Load from URL',
  registry: 'Load from registry',
}

const field = 'block w-full border p-1'

export function BlueprintForm({ form, onChange, running, busy, onValidate, onRun, onStop, onSave, onNew }: Props) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => onChange({ ...form, [key]: value })
  const hasSource =
    form.sourceKind === 'text' ? form.markdown.trim() !== ''
    : form.sourceKind === 'url' ? form.url.trim() !== ''
    : form.registryRef.trim() !== ''

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onRun()
      }}
    >
      <fieldset className="flex flex-wrap gap-4">
        <legend className="font-semibold">Blueprint source</legend>
        {(Object.keys(SOURCE_LABELS) as SourceKind[]).map((kind) => (
          <label key={kind} className="flex items-center gap-1">
            <input
              type="radio"
              name="sourceKind"
              value={kind}
              checked={form.sourceKind === kind}
              onChange={() => set('sourceKind', kind)}
            />
            {SOURCE_LABELS[kind]}
          </label>
        ))}
      </fieldset>

      {form.sourceKind === 'text' ? (
        <>
          <label className="block">
            Name
            <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="block">
            Blueprint (Markdown persona)
            <textarea
              className={`${field} h-72 font-mono text-sm`}
              value={form.markdown}
              onChange={(e) => set('markdown', e.target.value)}
              spellCheck={false}
            />
          </label>
        </>
      ) : form.sourceKind === 'url' ? (
        <label className="block">
          Persona URL (https, allowed hosts only)
          <input
            className={field}
            type="url"
            placeholder="https://"
            value={form.url}
            onChange={(e) => set('url', e.target.value)}
          />
        </label>
      ) : (
        <label className="block">
          Registry ref
          <input
            className={field}
            placeholder="domain/name@version"
            value={form.registryRef}
            onChange={(e) => set('registryRef', e.target.value)}
          />
        </label>
      )}

      <div className="flex flex-wrap gap-4">
        <label>
          Provider
          <select className={field} value={form.provider} onChange={(e) => set('provider', e.target.value as Provider)}>
            {PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Runtime
          <select className={field} value={form.runtime} onChange={(e) => set('runtime', e.target.value as Runtime)}>
            {RUNTIMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        Prompt
        <textarea className={`${field} h-20`} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="border px-2 py-1" disabled={busy || running || !hasSource} onClick={onValidate}>
          Validate
        </button>
        {running ? (
          <button type="button" className="border px-2 py-1" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="border px-2 py-1" disabled={busy || !hasSource}>
            Run
          </button>
        )}
        <button
          type="button"
          className="border px-2 py-1"
          disabled={busy || form.sourceKind !== 'text' || !hasSource || form.name.trim() === ''}
          onClick={onSave}
        >
          {form.id ? 'Save' : 'Save as new'}
        </button>
        <button type="button" className="border px-2 py-1" disabled={busy || running} onClick={onNew}>
          New
        </button>
      </div>
    </form>
  )
}
