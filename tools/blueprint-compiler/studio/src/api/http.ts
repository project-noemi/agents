import type {
  BlueprintInput,
  RunRecord,
  RunRequest,
  SavedBlueprint,
  SavedBlueprintSummary,
  StreamEvent,
  StudioApi,
  ValidateResult,
} from './types'

// Adapter for the real Studio server (routes: src/server.js). They are kept in
// this one file. In dev, Vite proxies /api to the server (see vite.config.ts).
const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(await errorText(res))
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.message === 'string') return body.message
  } catch {
    // not JSON; fall through
  }
  return `Request failed: HTTP ${res.status}`
}

// The run stream is server-sent events over a POST response: each event is
// one `data: <json>` block, separated by a blank line.
async function* readEvents(res: Response): AsyncGenerator<StreamEvent> {
  if (!res.body) throw new Error('The server returned no stream.')
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let end
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (data) yield JSON.parse(data) as StreamEvent
    }
  }
}

export const httpApi: StudioApi = {
  validate: (input: BlueprintInput) =>
    request<ValidateResult>('/validate', { method: 'POST', body: JSON.stringify({ input }) }),

  async *run(req: RunRequest, signal?: AbortSignal) {
    const res = await fetch(`${BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(req),
      signal,
    })
    if (!res.ok) throw new Error(await errorText(res))
    yield* readEvents(res)
  },

  listBlueprints: () => request<SavedBlueprintSummary[]>('/blueprints'),

  getBlueprint: (id) => request<SavedBlueprint>(`/blueprints/${encodeURIComponent(id)}`),

  saveBlueprint: ({ id, ...body }) =>
    id
      ? request<SavedBlueprint>(`/blueprints/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      : request<SavedBlueprint>('/blueprints', { method: 'POST', body: JSON.stringify(body) }),

  renameBlueprint: (id, name) =>
    request<SavedBlueprint>(`/blueprints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  listRuns: () => request<RunRecord[]>('/runs'),

  deleteBlueprint: (id) =>
    request<void>(`/blueprints/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}