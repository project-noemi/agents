import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usage } from '../test/fake-api'
import { ArenaColumns } from './ArenaColumns'

describe('ArenaColumns', () => {
  it('shows one column per provider with latency, tokens and cost', () => {
    render(
      <ArenaColumns
        columns={[
          { provider: 'gemini', status: 'done', model: 'gemini-3.8-flash', text: 'Hello there', usage: usage() },
          { provider: 'xai', status: 'streaming', text: 'Bon' },
        ]}
      />,
    )

    const gemini = screen.getByRole('article', { name: 'gemini result' })
    expect(within(gemini).getByText('Hello there')).toBeInTheDocument()
    expect(within(gemini).getByText('gemini-3.8-flash')).toBeInTheDocument()
    expect(within(gemini).getByText('done')).toBeInTheDocument()
    expect(within(gemini).getByText('850 ms')).toBeInTheDocument()
    expect(within(gemini).getByText('1200 / 340')).toBeInTheDocument()
    expect(within(gemini).getByText('$0.0021')).toBeInTheDocument()

    const xai = screen.getByRole('article', { name: 'xai result' })
    expect(within(xai).getByText('streaming')).toBeInTheDocument()
    // No usage until the provider finishes.
    expect(within(xai).getAllByText('—')).toHaveLength(3)
  })

  it('shows a failed provider with its stage and error codes', () => {
    render(
      <ArenaColumns
        columns={[
          {
            provider: 'xai',
            status: 'failed',
            text: '',
            failure: { stage: 'provider', errors: [{ code: 'TIMEOUT', message: 'No answer in 30 s.' }] },
          },
        ]}
      />,
    )
    const xai = screen.getByRole('article', { name: 'xai result' })
    expect(within(xai).getByText('failed')).toBeInTheDocument()
    expect(within(xai).getByRole('alert')).toHaveTextContent('Failed at stage: provider')
    expect(within(xai).getByRole('alert')).toHaveTextContent('TIMEOUT')
  })
})
