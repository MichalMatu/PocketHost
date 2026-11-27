import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
// This page is tested in isolation; App provides the layout contexts in production.
vi.mock('@/components/layouts/base-layout', () => ({
  BaseLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

import PlatformPage from '@/app/settings/platform/page'

afterEach(() => vi.unstubAllGlobals())

const boot = {
  state: 'scripts-present',
  scriptCount: 3,
  ownerExecutableCount: 2,
  androidPermission: 'not-verified',
  rebootReadback: 'not-verified',
  checkedAt: '2026-11-16T21:00:00.000Z',
}

describe('Platform read-only Termux:Boot mode diagnostics', () => {
  it('shows owner-executable count without claiming Android startup', async () => {
    const fetcher = vi.fn(async (route: string) => ({
      ok: route.includes('mode=service-boot'),
      json: async () => boot,
    }))
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter><PlatformPage /></MemoryRouter>)
    expect(await screen.findByText('3 script(s) · 2 owner-executable · reboot unverified'))
      .toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' }).classList.contains('h-8')).toBe(true)
    for (const name of ['Configure LAN', 'Inspect SSH', 'Inspect autostart']) {
      expect(screen.getByRole('link', { name }).classList.contains('h-8')).toBe(true)
    }
    expect(fetcher.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true)
  })

  it('refuses impossible executable counts in an untrusted response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (route: string) => ({
      ok: route.includes('mode=service-boot'),
      json: async () => ({ ...boot, ownerExecutableCount: 4 }),
    })))
    render(<MemoryRouter><PlatformPage /></MemoryRouter>)
    await screen.findByText('Termux:Boot')
    expect(screen.queryByText(/3 script\(s\) · 4 owner-executable/)).toBeNull()
  })
})
