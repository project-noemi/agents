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

export type Stage = 'load' | 'parse' | 'validate' | 'resolve' | 'provider' | 'internal'

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
  blueprintId?: string // links the history row to a saved blueprint
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

// One row of run history. The server never stores the prompt, the persona text,
// the output or error messages: only codes.
//   provider/runtime: who answered, or what was asked for if nothing answered.
//   blueprint: the compiled id (e.g. coding/architect), or the input kind when it failed to load.
export type RunOutcome = 'ok' | 'fallback' | 'error'

export type RunRecord = {
  id: string
  at: string
  durationMs: number
  blueprintId?: string
  blueprint: string
  provider: string | null
  runtime: string | null
  model?: string
  inputTokens: number
  outputTokens: number
  outcome: RunOutcome
  stage?: Stage
  errorCodes?: string[]
  fallbacks: { provider: string; reason: string }[]
}

// ---- LLM Arena (Sprint 5) --------------------------------------------------
// One saved blueprint and one prompt, run on every provider at the same time.
// A provider that fails is recorded as failed; the Arena never falls back.

export type ArenaRequest = {
  blueprintId: string
  prompt: string
}

// One event per message on the Arena stream. Every per-provider event names its
// provider, so the events of the providers can arrive interleaved.
export type ArenaEvent =
  // First event: the compiled blueprint and the providers that will run.
  | { type: 'arena'; id: string; blueprint: string; providers: string[] }
  | { type: 'start'; provider: string; model?: string }
  | { type: 'token'; provider: string; text: string }
  | { type: 'done'; provider: string; model?: string; usage: Usage }
  // This provider failed. The others carry on.
  | { type: 'failed'; provider: string; stage: Stage; errors: CompileError[] }
  // The whole Arena run failed before any provider ran (for example a bad blueprint).
  | { type: 'error'; stage: Stage; errors: CompileError[] }
  // Last event: every provider has finished and the run is saved.
  | { type: 'end'; id: string }

// One scoreboard row per provider, totalled over the saved Arena runs.
export type ScoreboardRow = {
  provider: string
  runs: number
  ok: number
  failed: number
  // Average over successful answers; null when there are none.
  avgLatencyMs: number | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface StudioApi {
  validate(input: BlueprintInput): Promise<ValidateResult>
  run(request: RunRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>
  listBlueprints(): Promise<SavedBlueprintSummary[]>
  getBlueprint(id: string): Promise<SavedBlueprint>
  // No id creates a new blueprint; an id overwrites that one.
  saveBlueprint(blueprint: { id?: string; name: string; markdown: string }): Promise<SavedBlueprint>
  renameBlueprint(id: string, name: string): Promise<SavedBlueprint>
  deleteBlueprint(id: string): Promise<void>
  // Newest first.
  listRuns(): Promise<RunRecord[]>
  arena(request: ArenaRequest, signal?: AbortSignal): AsyncIterable<ArenaEvent>
  scoreboard(): Promise<ScoreboardRow[]>
}