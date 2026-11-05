import { httpApi } from './http'
import { mockApi } from './mock'

export * from './types'

// Which backend the UI talks to. Defaults to the offline mock until the Studio
// server exists; start Vite with VITE_STUDIO_BACKEND=http to use the server.
// This is a mode switch, not a secret: keys never reach the browser.
export const backend = import.meta.env.VITE_STUDIO_BACKEND === 'http' ? 'http' : 'mock'

export const api = backend === 'http' ? httpApi : mockApi
