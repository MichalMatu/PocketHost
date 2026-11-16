import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunitHealthPanel } from '@/app/termux/runit-health';

afterEach(() => vi.unstubAllGlobals());

describe('S4 heartbeat policy receipt', () => {
  it('does not report success when the server confirms a different threshold', async () => {
    const user = userEvent.setup();
    const heartbeat = {
      mode: 'disabled',
      staleAfterSeconds: null,
      status: 'disabled',
      lastOutputAt: null,
    };
    const requests = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => options?.method === 'POST'
        // A stale or contradictory 200 response must not be treated as a
        // successful 300-second policy write.
        ? { changed: true, heartbeat }
        : url.includes('mode=service-health&name=')
          ? {
              name: 'sample-worker',
              identity: 'verified',
              observed: 'stopped',
              readiness: 'not-verified',
              process: {
                status: 'stopped', pid: null, uptimeSeconds: null, startTicks: null,
              },
              heartbeat,
              autostart: false,
              logEvidence: 'no-log',
              lastLogWriteAt: null,
              checkedAt: new Date().toISOString(),
            }
          : {
              services: [{
                name: 'sample-worker', registered: true, protected: false,
                template: 'heartbeat-worker-v1',
              }],
            },
    }));
    vi.stubGlobal('fetch', requests);
    render(<RunitHealthPanel />);
    await user.click(await screen.findByRole('button', { name: 'Inspect health' }));
    await screen.findByRole('button', { name: '5 min' });
    await user.click(screen.getByRole('button', { name: '5 min' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Heartbeat policy refused or readback unconfirmed',
    );
    expect(screen.queryByText(/worker heartbeat policy saved and verified/)).toBeNull();
    const posts = requests.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(posts).toHaveLength(1);
  });
});
