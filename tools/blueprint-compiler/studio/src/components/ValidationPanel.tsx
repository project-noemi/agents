import type { ValidateResult } from '../api'
import { ErrorList } from './ErrorList'

// Outcome of a validate call: the failing stage and its errors, or a short
// summary of the compiled IR and what its refs resolved to.
export function ValidationPanel({ result }: { result: ValidateResult }) {
  if (!result.ok) return <ErrorList stage={result.stage} errors={result.errors} />

  const { ir, resolved } = result
  return (
    <div className="border border-green-600 p-2">
      <p className="font-semibold">Valid blueprint</p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3">
        <dt>ID</dt>
        <dd>
          <code>{ir.id}</code>
        </dd>
        <dt>Title</dt>
        <dd>{ir.title}</dd>
        <dt>Sections</dt>
        <dd>{Object.keys(ir.sections).length}</dd>
        <dt>Skills</dt>
        <dd>{resolved.skills.map((s) => s.path).join(', ') || '(none)'}</dd>
        <dt>MCP</dt>
        <dd>{resolved.mcp.map((m) => m.path).join(', ') || '(none)'}</dd>
      </dl>
    </div>
  )
}
