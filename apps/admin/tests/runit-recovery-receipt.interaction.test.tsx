import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunitHealthPanel } from '@/app/termux/runit-health';

afterEach(() => vi.unstubAllGlobals());

describe('S4 one-shot recovery command receipt', () => {
  it('refuses success when budget advances but runit result is absent', async () => {
    const user = userEvent.setup();
    const recovery = {
      name: 'fixed-worker',
      template: 'heartbeat-worker-v1',
      observed: 'stopped',
      readiness: 'not-verified',
      action: 'start',
      reason: 'eligible',
      attempts: 0,
      maxAttempts: 2,
      nextEligibleAt: null,
      windowEndsAt: null,
      checkedAt: new Date().toISOString(),
    };
    const health = {
      name: 'fixed-worker',
      identity: 'verified',
      observed: 'stopped',
      readiness: 'not-verified',
      process: { status: 'stopped', pid: null, uptimeSeconds: null, startTicks: null },
      heartbeat: { mode: 'disabled', staleAfterSeconds: null, status: 'disabled', lastOutputAt: null },
      autostart: false,
      logEvidence: 'no-log',
      lastLogWriteAt: null,
      checkedAt: new Date().toISOString(),
    };
    const requests = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => options?.method === 'POST'
        ? { requested: true, review: { ...recovery, attempts: 1, action: 'blocked' } }
        : url.includes('mode=service-recovery')
          ? recovery
          : url.includes('mode=service-health&')
            ? health
            : { services: [{
                name: 'fixed-worker', registered: true, protected: false,
                control: 'standalone', identity: 'verified',
                identityReason: 'run-sha-attested', template: 'heartbeat-worker-v1',
              }] },
    }));
    vi.stubGlobal('fetch', requests);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<RunitHealthPanel />);
    await user.click(await screen.findByRole('button', { name: 'Review recovery' }));
    await user.click(await screen.findByRole('button', { name: 'Request one recovery start' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Recovery refused or readback unconfirmed',
    );
    expect(screen.queryByText(/one recovery attempt recorded and independently verified/)).toBeNull();
    expect(requests.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1);
  });
});
