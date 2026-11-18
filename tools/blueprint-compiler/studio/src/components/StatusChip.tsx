import type { ReactNode } from 'react'

export type Tone = 'success' | 'error' | 'warning' | 'info' | 'secondary'

// A small status chip. The word is always visible, so status never relies on color alone.
export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={tone === 'secondary' ? 'chip' : `chip chip-${tone}`}>{children}</span>
}
