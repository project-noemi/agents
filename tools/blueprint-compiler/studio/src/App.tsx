import { useEffect, useState } from 'react'
import { api as defaultApi, backend } from './api'
import type { StudioApi } from './api'
import { ArenaPage } from './pages/ArenaPage'
import { StudioPage } from './pages/StudioPage'

type Page = 'studio' | 'arena'

const PAGES: { id: Page; label: string; hash: string }[] = [
  { id: 'studio', label: 'Studio', hash: '#/' },
  { id: 'arena', label: 'Arena', hash: '#/arena' },
]

// Hash routing keeps the two pages linkable without a router dependency.
const pageFromHash = (): Page => (window.location.hash.startsWith('#/arena') ? 'arena' : 'studio')

function App({ api = defaultApi }: { api?: StudioApi }) {
  const [page, setPage] = useState<Page>(pageFromHash)

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      <header className="app-bar">
        <div className="container-studio flex min-h-(--size-app-bar) flex-wrap items-center gap-x-4">
          <p className="mr-auto">NoéMI Studio</p>
          <nav aria-label="Pages" className="flex gap-1">
            {PAGES.map((p) => (
              <a key={p.id} href={p.hash} className="btn" aria-current={page === p.id ? 'page' : undefined}>
                {p.label}
              </a>
            ))}
          </nav>
          <p className="text-body-sm">Backend: {backend === 'mock' ? 'offline mock (no server)' : 'Studio server'}</p>
        </div>
      </header>

      <main className="container-studio py-4">
        {page === 'arena' ? <ArenaPage api={api} /> : <StudioPage api={api} />}
      </main>
    </>
  )
}

export default App
