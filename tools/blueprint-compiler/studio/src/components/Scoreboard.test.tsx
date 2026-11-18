import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { row } from '../test/fake-api'
import { Scoreboard } from './Scoreboard'

describe('Scoreboard', () => {
  it('says so when there are no Arena runs yet', () => {
    render(<Scoreboard rows={[]} onRefresh={() => {}} />)
    expect(screen.getByText('No Arena runs yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('lists providers best first with their totals', () => {
    render(
      <Scoreboard
        rows={[
          row({ provider: 'xai', runs: 4, ok: 3, failed: 1, avgLatencyMs: 1500, costUsd: 0.042 }),
          row({ provider: 'gemini', runs: 4, ok: 4, failed: 0, avgLatencyMs: 640, costUsd: 0.0031 }),
          row({ provider: 'mock', runs: 4, ok: 0, failed: 4, avgLatencyMs: null, inputTokens: 0, outputTokens: 0, costUsd: 0 }),
        ]}
        onRefresh={() => {}}
      />,
    )

    const cells = within(screen.getByRole('table', { name: 'Scoreboard' }))
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    expect(cells).toEqual([
      ['1', 'gemini', '4', '4', '0', '640 ms', '4800 / 1200', '$0.0031'],
      ['2', 'xai', '4', '3', '1', '1.5 s', '4800 / 1200', '$0.04'],
      ['3', 'mock', '4', '0', '4', '—', '0 / 0', '$0.00'],
    ])
  })

  it('refreshes on request', async () => {
    const onRefresh = vi.fn()
    render(<Scoreboard rows={[]} onRefresh={onRefresh} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
