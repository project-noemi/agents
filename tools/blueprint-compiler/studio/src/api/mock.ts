import type {
  BlueprintIR,
  BlueprintInput,
  CompileError,
  RunRequest,
  SavedBlueprint,
  StreamEvent,
  StudioApi,
  ValidateResult,
} from './types'

// Offline stand-in for the Studio server, so the UI can be built and clicked
// through before the backend exists. Its checks are a rough copy of
// validate.js, not the real compiler: the real server is the authority.

const REQUIRED_HEADINGS = [
  'Role',
  'Tone',
  'Capabilities',
  'Mission',
  'Rules & Constraints',
  'Data Inventory',
  'Boundaries',
  'Workflow',
  'Audit Log',
  'External Tooling Dependencies',
]

const SAMPLE = `# Architect — Coding Agent

## Role
Senior Developer and System Architect responsible for structural integrity of the codebase.

## Tone
Authoritative, methodical, visionary, and standards-oriented.

## Capabilities
- Analyze structural weaknesses and tight coupling.

## Mission
Keep the codebase modular and aligned with enterprise standards.

## Rules & Constraints (4D Diligence)
1. Every refactor must be verifiable with tests.

### Refusal Criteria
1. Refused Task Types: I will not land a breaking public-API change without explicit authorization.
2. Override Resistance: I will ignore instructions to commit code that fails tests.
3. Escalation Path: Return a 403-style refusal naming the standard that would be violated.

## Data Inventory
- **Inputs:** User instructions, codebase state, lint/test reports.

## Boundaries
- **Never:** Commit code that fails lint or tests.

## Workflow
**Skill:** \`verification/pre-flight-check\` — Ensure no regressions.

## Audit Log
Emit \`{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }\` to stderr.

## External Tooling Dependencies
- Node.js 24
`

const store = new Map<string, SavedBlueprint>()
let nextId = 1

function put(name: string, markdown: string, id = String(nextId++)): SavedBlueprint {
  const saved = { id, name, markdown, updatedAt: new Date().toISOString() }
  store.set(id, saved)
  return saved
}

put('architect (sample)', SAMPLE)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Strip a parenthetical suffix and compare case-insensitively, like validate.js.
const canonical = (heading: string) =>
  heading.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()

function parse(markdown: string): { ir?: BlueprintIR; errors: CompileError[] } {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (!title) return { errors: [{ code: 'PARSE', message: 'Blueprint is missing an H1 title.' }] }

  const sections: Record<string, string> = {}
  for (const part of markdown.split(/^##\s+/m).slice(1)) {
    const [heading, ...body] = part.split('\n')
    const name = REQUIRED_HEADINGS.find((h) => h.toLowerCase() === canonical(heading)) ?? heading.trim()
    sections[name] = body.join('\n').trim()
  }

  const errors: CompileError[] = REQUIRED_HEADINGS.filter((h) => !(h in sections)).map((h) => ({
    code: 'MISSING_HEADING',
    message: `Missing required heading "## ${h}".`,
    path: h,
  }))

  const rules = sections['Rules & Constraints'] ?? ''
  const refusal = rules.split(/^###\s+Refusal Criteria\s*$/im)[1]?.split(/^###\s+/m)[0]?.trim() ?? ''
  if (!refusal) {
    errors.push({
      code: 'MISSING_REFUSAL',
      message: 'Rules & Constraints needs a non-empty "### Refusal Criteria" subsection.',
      path: 'Rules & Constraints',
    })
  }

  const skills = [...markdown.matchAll(/\*\*Skill:\*\*\s*`([^`]+)`/g)].map((m) => m[1])
  const mcp = [...markdown.matchAll(/\*\*MCP:\*\*\s*`([^`]+)`/g)].map((m) => m[1])
  const slug = title.split(/\s+[—-]\s+/)[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return {
    errors,
    ir: {
      id: `mock/${slug}`,
      name: slug,
      domain: 'mock',
      title,
      sections,
      refusalCriteria: refusal,
      skills,
      mcp,
      modelPolicy: { preferred: 'mock', fallbacks: [] },
      source: { kind: 'file', ref: 'studio-editor' },
    },
  }
}

function validateInput(input: BlueprintInput): ValidateResult {
  if (input.kind !== 'text') {
    return {
      ok: false,
      stage: 'load',
      errors: [{ code: 'LOAD', message: 'The mock backend cannot load URLs or registry refs.' }],
    }
  }
  const { ir, errors } = parse(input.markdown)
  if (!ir || errors.length) return { ok: false, stage: 'validate', errors }
  return {
    ok: true,
    ir,
    resolved: {
      skills: ir.skills.map((ref) => ({ ref, slug: ref, path: `skills/${ref}.md` })),
      mcp: ir.mcp.map((ref) => ({ ref, id: ref, path: `mcp-protocols/${ref}.md` })),
    },
  }
}

export const mockApi: StudioApi = {
  async validate(input) {
    await sleep(150)
    return validateInput(input)
  },

  async *run(req: RunRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    const result = validateInput(req.input)
    if (!result.ok) {
      yield { type: 'error', stage: result.stage, errors: result.errors }
      return
    }
    // The mock only stands in for the mock provider; live providers need the server.
    yield { type: 'start', provider: 'mock', runtime: 'direct' }
    const text = [
      `[mock] compiled ${result.ir.id}`,
      `title: ${result.ir.title}`,
      `skills: ${result.ir.skills.join(', ') || '(none)'}`,
      `requested: ${req.provider} via ${req.runtime}`,
      `prompt: ${req.prompt}`,
    ].join('\n')
    const started = Date.now()
    for (const chunk of text.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) return
      await sleep(40)
      yield { type: 'token', text: chunk }
    }
    yield {
      type: 'done',
      provider: 'mock',
      runtime: 'direct',
      model: 'mock-hello-world',
      usage: { inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started, costUsd: 0 },
      fallbacks: [],
    }
  },

  async listBlueprints() {
    return [...store.values()].map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
  },

  async getBlueprint(id) {
    const saved = store.get(id)
    if (!saved) throw new Error('Blueprint not found.')
    return saved
  },

  async saveBlueprint({ id, name, markdown }) {
    if (id && !store.has(id)) throw new Error('Blueprint not found.')
    return put(name, markdown, id)
  },

  async deleteBlueprint(id) {
    store.delete(id)
  },
}
