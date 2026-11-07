import type { SavedBlueprintSummary } from '../api'

export type ArenaFormState = {
  blueprintId: string
  prompt: string
}

type Props = {
  form: ArenaFormState
  onChange: (form: ArenaFormState) => void
  blueprints: SavedBlueprintSummary[]
  running: boolean
  onRun: () => void
}

// Pick a saved blueprint, type a prompt, run.
export function ArenaForm({ form, onChange, blueprints, running, onRun }: Props) {
  const ready = form.blueprintId !== '' && form.prompt.trim() !== ''

  return (
    <form
      aria-label="Arena run"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !running) onRun()
      }}
    >
      <label className="block">
        Blueprint
        <select
          className="field"
          value={form.blueprintId}
          onChange={(e) => onChange({ ...form, blueprintId: e.target.value })}
        >
          <option value="">Choose a saved blueprint</option>
          {blueprints.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        Prompt
        <textarea
          className="field h-20"
          value={form.prompt}
          onChange={(e) => onChange({ ...form, prompt: e.target.value })}
        />
      </label>

      <button type="submit" className="btn btn-primary" disabled={!ready || running}>
        Run
      </button>
    </form>
  )
}
