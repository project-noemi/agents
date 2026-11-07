import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi } from './test/fake-api'

afterEach(() => {
  window.location.hash = ''
})

describe('App shell', () => {
  it('switches between the Studio and Arena pages and marks the active one', async () => {
    render(<App api={fakeApi()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Studio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Studio' })).toHaveAttribute('aria-current', 'page')

    act(() => {
      window.location.hash = '#/arena'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'LLM Arena' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Arena' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Studio' })).not.toHaveAttribute('aria-current')
  })
})
