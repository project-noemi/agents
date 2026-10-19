// Shapes shared with the backend. The compiler-side types mirror
// tools/blueprint-compiler/src/ir.js and compile.js; keep them in sync.

export type SourceRef = {
  kind: 'file' | 'http' | 'registry'
  ref: string
  version?: string
}

export type BlueprintIR = {
  id: string
  name: string
  domain: string
  title: string
  sections: Record<string, string>
  refusalCriteria: string
  skills: string[]
  mcp: string[]
  modelPolicy: { preferred: string; fallbacks: string[] }
  source: SourceRef
}

export type CompileError = {
  code: string
  message: string
  path?: string
  status?: number
}

export type ResolvedRefs = {
  skills: { ref: string; slug: string; path: string }[]
  mcp: { ref: string; id: string; path: string }[]
}

export type Stage = 'load' | 'parse' | 'validate' | 'resolve' | 'provider'

export type CompileFailure = {
  ok: false
  stage: Stage
  errors: CompileError[]
}

export type ValidateResult =
  | { ok: true; ir: BlueprintIR; resolved: ResolvedRefs }
  | CompileFailure

export type Usage = {
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costUsd: number
}

// Where the persona comes from. The backend turns url/registry into the
// compiler's http/registry loaders (and must set NOEMI_HTTP_ALLOWED_HOSTS
// before it accepts a URL).
export type BlueprintInput =
  | { kind: 'text'; markdown: string }
  | { kind: 'url'; url: string }
  | { kind: 'registry'; ref: string }

export const PROVIDERS = ['mock', 'gemini', 'xai'] as const
export type Provider = (typeof PROVIDERS)[number]

export const RUNTIMES = ['direct', 'mastra'] as const
export type Runtime = (typeof RUNTIMES)[number]

export type RunRequest = {
  input: BlueprintInput
  prompt: string
  provider: Provider
  runtime: Runtime
}

// One event per message on the run stream.
export type StreamEvent =
  | { type: 'start'; provider: string; runtime: string }
  | { type: 'token'; text: string }
  | {
      type: 'done'
      provider: string
      runtime: string
      model?: string
      usage?: Usage
      fallbacks?: { provider: string; reason: string }[]
    }
  | { type: 'error'; stage: Stage; errors: CompileError[] }

export type SavedBlueprintSummary = {
  id: string
  name: string
  updatedAt: string
}

export type SavedBlueprint = SavedBlueprintSummary & { markdown: string }

export interface StudioApi {
  validate(input: BlueprintInput): Promise<ValidateResult>
  run(request: RunRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>
  listBlueprints(): Promise<SavedBlueprintSummary[]>
  getBlueprint(id: string): Promise<SavedBlueprint>
  // No id creates a new blueprint; an id overwrites that one.
  saveBlueprint(blueprint: { id?: string; name: string; markdown: string }): Promise<SavedBlueprint>
  deleteBlueprint(id: string): Promise<void>
}
