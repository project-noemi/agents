import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeApi, row, streamOf, usage } from '../test/fake-api'
import { ArenaPage } from './ArenaPage'

async function fillForm(prompt = 'Review this design') {
  const user = userEvent.setup()
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Blueprint' }), 'architect')
  await user.type(screen.getByRole('textbox', { name: 'Prompt' }), prompt)
  return user
}

describe('ArenaPage', () => {
  it('keeps Run disabled until a blueprint and a prompt are given', async () => {
    render(<ArenaPage api={fakeApi()} />)
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run).toBeDisabled()

    const user = userEvent.setup()
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Blueprint' }), 'architect')
    expect(run).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'hi')
    expect(run).toBeEnabled()
  })

  it('runs the chosen blueprint and fills a column per provider', async () => {
    const api = fakeApi({
      arena: vi.fn(() =>
        streamOf([
          { type: 'arena', id: 'r1', blueprint: 'coding/architect', providers: ['gemini', 'xai'] },
          { type: 'start', provider: 'gemini', model: 'gemini-3.8-flash' },
          { type: 'token', provider: 'gemini', text: 'Looks good.' },
          { type: 'failed', provider: 'xai', stage: 'provider', errors: [{ code: 'RATE_LIMITED', message: 'HTTP 429' }] },
          { type: 'done', provider: 'gemini', usage: usage({ latencyMs: 420, costUsd: 0.0009 }) },
          { type: 'end', id: 'r1' },
        ]),
      ),
      scoreboard: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([row({ provider: 'gemini', runs: 1, ok: 1 }), row({ provider: 'xai', runs: 1, ok: 0, failed: 1 })]),
    })
    render(<ArenaPage api={api} />)

    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Run' }))

    const gemini = await screen.findByRole('article', { name: 'gemini result' })
    await waitFor(() => expect(within(gemini).getByText('done')).toBeInTheDocument())
    expect(within(gemini).getByText('Looks good.')).toBeInTheDocument()
    expect(within(gemini).getByText('420 ms')).toBeInTheDocument()
    expect(within(gemini).getByText('$0.0009')).toBeInTheDocument()

    const xai = screen.getByRole('article', { name: 'xai result' })
    expect(within(xai).getByText('failed')).toBeInTheDocument()
    expect(within(xai).getByRole('alert')).toHaveTextContent('RATE_LIMITED')

    expect(vi.mocked(api.arena).mock.calls[0][0]).toEqual({ blueprintId: 'a1', prompt: 'Review this design' })

    // The scoreboard reloads once the run is saved.
    const board = await screen.findByRole('table', { name: 'Scoreboard' })
    expect(within(board).getByText('gemini')).toBeInTheDocument()
    expect(api.scoreboard).toHaveBeenCalledTimes(2)
  })

  it('shows a failed request as an error alert', async () => {
    const api = fakeApi({
      arena: vi.fn(() => {
        throw new Error('Request failed: HTTP 429')
      }),
    })
    render(<ArenaPage api={api} />)
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Run' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed: HTTP 429')
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
  })

  it('shows a blueprint that fails to compile as a stage error', async () => {
    const api = fakeApi({
      arena: vi.fn(() =>
        streamOf([{ type: 'error', stage: 'validate', errors: [{ code: 'MISSING_REFUSAL', message: 'No refusal criteria.' }] }]),
      ),
    })
    render(<ArenaPage api={api} />)
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Run' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed at stage: validate')
    expect(alert).toHaveTextContent('MISSING_REFUSAL')
    expect(screen.queryByRole('article')).toBeNull()
  })
})
