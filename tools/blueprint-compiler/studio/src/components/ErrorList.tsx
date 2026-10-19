import type { CompileError, Stage } from '../api'

type Props = { stage: Stage; errors: CompileError[] }

// Structured compiler errors, labeled with the stage that failed.
export function ErrorList({ stage, errors }: Props) {
  return (
    <div role="alert" className="border border-red-400 p-2">
      <p className="font-semibold">Failed at stage: {stage}</p>
      <ul className="list-disc pl-5">
        {errors.map((e, i) => (
          <li key={i}>
            <code>{e.code}</code>
            {e.path ? <> ({e.path})</> : null}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
