import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RunitHealthPanel } from '@/app/termux/runit-health';

afterEach(() => vi.unstubAllGlobals());

describe('S4 verified standalone worker inventory', () => {
  it('hides Health/Recovery actions for delegated or non-attested services', async () => {
    const get = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        services: [
          {
            name: 'project-worker', registered: true, protected: false,
            control: 'delegated', identity: 'verified',
            identityReason: 'run-sha-attested',
          },
          {
            name: 'changed-worker', registered: true, protected: false,
            control: 'standalone', identity: 'changed',
            identityReason: 'run-script-changed', template: 'heartbeat-worker-v1',
          },
          {
            name: 'healthy-worker', registered: true, protected: false,
            control: 'standalone', identity: 'verified',
            identityReason: 'run-sha-attested', template: 'heartbeat-worker-v1',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', get);
    render(<MemoryRouter><RunitHealthPanel /></MemoryRouter>);
    await screen.findByText('healthy-worker');
    expect(screen.queryByText('project-worker')).toBeNull();
    expect(screen.queryByText('changed-worker')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Inspect health' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Review recovery' })).toHaveLength(1);
  });

  it('offers a safe route to create a stopped worker when none are attested', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ services: [] }),
    })));
    render(<MemoryRouter><RunitHealthPanel /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Create standalone worker' });
    expect(link.getAttribute('href')).toBe('/services/runit');
    expect(link.classList.contains('h-8')).toBe(true);
    expect(screen.getByRole('button', { name: 'Refresh services' }).classList.contains('h-8')).toBe(true);
    expect(screen.getByRole('button', { name: 'Inspect all workers' }).classList.contains('h-8')).toBe(true);
  });
});
