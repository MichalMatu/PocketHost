import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { RunitHealthPanel } from '@/app/termux/runit-health'

afterEach(() => vi.unstubAllGlobals())

const verified = {
  name: 'owned-worker',
  registered: true,
  protected: false,
  control: 'standalone',
  identity: 'verified',
  identityReason: 'run-sha-attested',
  template: 'heartbeat-worker-v1',
}

describe('S4 overview inventory attestation', () => {
  it('refuses an observed worker absent from the separately verified inventory', async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('service-health-overview')
        ? {
            checkedAt: new Date().toISOString(),
            blockedRegistrations: 0,
            truncated: false,
            rows: [{
              name: 'foreign-worker',
              template: 'heartbeat-worker-v1',
              status: 'observed',
              health: {
                name: 'foreign-worker', identity: 'verified',
                observed: 'stopped', readiness: 'not-verified',
                process: {
                  status: 'stopped', pid: null,
                  uptimeSeconds: null, startTicks: null,
                },
                heartbeat: { mode: 'disabled', status: 'disabled' },
                logEvidence: 'no-log', autostart: false,
                checkedAt: new Date().toISOString(),
              },
            }],
          }
        : { services: [verified] },
    }))
    vi.stubGlobal('fetch', requests)
    render(<MemoryRouter><RunitHealthPanel /></MemoryRouter>)
    await screen.findByText('owned-worker')
    await user.click(screen.getByRole('button', { name: 'Inspect all workers' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Worker health overview unavailable or changed',
    )
    expect(screen.queryByText('foreign-worker')).toBeNull()
    expect(requests.mock.calls.every(call => !call[1] ||
      call[1]?.method !== 'POST')).toBe(true)
  })

  it('rejects a duplicate overview identity rather than counting it twice', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('service-health-overview')
        ? {
            checkedAt: new Date().toISOString(),
            blockedRegistrations: 0,
            truncated: false,
            rows: [
              { name: 'owned-worker', template: 'heartbeat-worker-v1', status: 'unavailable' },
              { name: 'owned-worker', template: 'heartbeat-worker-v1', status: 'unavailable' },
            ],
          }
        : { services: [verified] },
    })))
    render(<MemoryRouter><RunitHealthPanel /></MemoryRouter>)
    await screen.findByText('owned-worker')
    await user.click(screen.getByRole('button', { name: 'Inspect all workers' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Worker health overview unavailable or changed',
    )
    expect(screen.queryByText('Workers: 2')).toBeNull()
  })
})
