# NoéMI Studio

Browser playground for the Blueprint Compiler. Two pages, linked from the app bar:

- **Studio** (Sprint 4, REQUIREMENTS.md §2.2): author, save, run a blueprint and stream the result.
- **Arena** (Sprint 5, REQUIREMENTS.md §2.3): pick a saved blueprint, type a prompt, run it on every provider.
  Provider columns sit side by side with latency, tokens and cost, above a scoreboard table.

Scaffolded from the official Vite `react-ts` template with Tailwind added. Styling follows the contributor
[UI style guide](../../../docs/contributing/ui-style-guide.md): `src/index.css` imports
[`ui-tokens.css`](../../../docs/contributing/ui-tokens.css) from `docs/` so the tokens have one source, and
Tailwind is used for layout only.

It has its own `package.json`. Do not add its dependencies to the repository root.

```bash
cd tools/blueprint-compiler/studio
npm install
npm run dev     # local dev server, offline mock backend
npm test        # component tests (Vitest, offline)
npm run build   # type-check and build to dist/
npm run lint
```

## Layout

| Path | What it is |
|---|---|
| `src/api/types.ts` | The contract with the backend: request, result and stream event shapes (mirrors `src/ir.js` and `compile.js`) |
| `src/api/http.ts` | Adapter for the real Studio server. The routes are kept in this one file |
| `src/api/mock.ts` | Offline stand-in so the UI works before the server exists. Its checks are approximate; the real compiler is the authority |
| `src/api/index.ts` | Picks the adapter |
| `src/App.tsx` | App bar and the switch between `#/` (Studio) and `#/arena` (Arena) |
| `src/pages/` | `StudioPage`, `ArenaPage` |
| `src/state.ts` | Studio form and run state |
| `src/arena.ts` | Arena state: the stream reducer, number formats and scoreboard order |
| `src/components/` | `BlueprintForm`, `BlueprintTable` (open / rename / delete), `RunTable` (run history), `ValidationPanel`, `StreamView`, `ErrorList`, `ArenaForm`, `ArenaColumns`, `Scoreboard`, `StatusChip`, `Icon` |

## Arena routes

The Arena page calls two routes. Their shapes are in `src/api/types.ts`.

**`POST /api/arena`** with body `{ blueprintId, prompt }`. The response is server-sent events, one
`data: <json>` block per event, as for `/api/run`:

| Event | Meaning |
|---|---|
| `{ type: 'arena', id, blueprint, providers }` | First event: the compiled blueprint id and the providers that will run |
| `{ type: 'start', provider, model? }` | That provider started |
| `{ type: 'token', provider, text }` | Streamed text. Providers interleave |
| `{ type: 'done', provider, model?, usage }` | That provider finished. `usage` is `{ inputTokens, outputTokens, latencyMs, costUsd }` |
| `{ type: 'failed', provider, stage, errors }` | That provider failed. No fallback; the others carry on |
| `{ type: 'error', stage, errors }` | The whole run failed before any provider ran |
| `{ type: 'end', id }` | Every provider finished and the run is saved |

A non-2xx response shows its JSON `message` as an error alert.

**`GET /api/arena/scoreboard`** returns one row per provider:
`{ provider, runs, ok, failed, avgLatencyMs, inputTokens, outputTokens, costUsd }`. `avgLatencyMs` is over
successful answers and is `null` when there are none. The page ranks rows by success rate, then average latency.

The offline mock answers only for the `mock` provider, as it does on the Studio page. It records Gemini and xAI
as failed, because they need the server.

## Plugging in the backend

1. Implement the `StudioApi` operations on the server (validate, run as a stream,
   list / get / save / delete blueprints, Arena stream, scoreboard), or change
   `http.ts` to match the server's routes.
2. Start the server, then run the UI against it:

   ```bash
   VITE_STUDIO_BACKEND=http npm run dev
   ```

   In dev, Vite forwards `/api` to `STUDIO_API_URL` (default `http://127.0.0.1:8787`).

`VITE_STUDIO_BACKEND` and `STUDIO_API_URL` are configuration, not secrets. API keys
stay on the server, which runs under `infisical run` / `op run`; nothing in the
browser needs or receives them. If the server loads URLs, it must set
`NOEMI_HTTP_ALLOWED_HOSTS` first.





## MORE INDEPTH STUDIO RUN

From tools/blueprint-compiler/studio/:

bash
npm run dev

Vite prints a local address, usually http://localhost:5173. Open it in your browser.

By default this uses the offline mock backend, so no server is needed. You can save, open, rename and delete blueprints, run with the mock provider, and watch the run history table fill up. The mock keeps everything in memory, so a page refresh resets it. The header shows “Backend: offline mock (no server)”.

To use the real server, where blueprints are saved to disk: you need two terminals.

Terminal 1, the server, from tools/blueprint-compiler/:

powershell
# PowerShell
$env:NOEMI_HTTP_ALLOWED_HOSTS = "raw.githubusercontent.com"
npm run studio
cmd
:: Command Prompt
set NOEMI_HTTP_ALLOWED_HOSTS=raw.githubusercontent.com
npm run studio

It prints Studio server listening on http://127.0.0.1:8787. It refuses to start without NOEMI_HTTP_ALLOWED_HOSTS, which is deliberate.

Terminal 2, the website, from tools/blueprint-compiler/studio/:

powershell
$env:VITE_STUDIO_BACKEND = "http"
npm run dev
cmd
set VITE_STUDIO_BACKEND=http
npm run dev

Open http://localhost:5173 again. The header should now say “Backend: Studio server”.

Quick check that saving works:

Paste a persona into the editor, for example fixtures/architect.core.md.
Enter a name and click Save as new.
Refresh the page. The blueprint should still be in the table, and a data/ folder with a <id>.json file should appear in tools/blueprint-compiler/.
Click Run with provider mock. A row should appear under Run history.