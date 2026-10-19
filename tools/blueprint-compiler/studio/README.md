# NoéMI Studio

Browser playground for the Blueprint Compiler (Sprint 4, REQUIREMENTS.md §2.2):
author, save, run a blueprint and stream the result. Form + table + stream view,
no design system. Scaffolded from the official Vite `react-ts` template with
Tailwind added. Styling is deliberately minimal for now.

It has its own `package.json`. Do not add its dependencies to the repository root.

```bash
cd tools/blueprint-compiler/studio
npm install
npm run dev     # local dev server, offline mock backend
npm run build   # type-check and build to dist/
npm run lint
```

## Layout

| Path | What it is |
|---|---|
| `src/api/types.ts` | The contract with the backend: request, result and stream event shapes (mirrors `src/ir.js` and `compile.js`) |
| `src/api/http.ts` | Adapter for the real Studio server. The routes are a proposal, kept in this one file |
| `src/api/mock.ts` | Offline stand-in so the UI works before the server exists. Its checks are approximate; the real compiler is the authority |
| `src/api/index.ts` | Picks the adapter |
| `src/state.ts` | Form and run state shared by the components |
| `src/components/` | `BlueprintForm`, `BlueprintTable`, `ValidationPanel`, `StreamView`, `ErrorList` |

## Plugging in the backend

1. Implement the `StudioApi` operations on the server (validate, run as a stream,
   list / get / save / delete blueprints), or change `http.ts` to match the
   server's routes.
2. Start the server, then run the UI against it:

   ```bash
   VITE_STUDIO_BACKEND=http npm run dev
   ```

   In dev, Vite forwards `/api` to `STUDIO_API_URL` (default `http://127.0.0.1:8787`).

`VITE_STUDIO_BACKEND` and `STUDIO_API_URL` are configuration, not secrets. API keys
stay on the server, which runs under `infisical run` / `op run`; nothing in the
browser needs or receives them. If the server loads URLs, it must set
`NOEMI_HTTP_ALLOWED_HOSTS` first.
