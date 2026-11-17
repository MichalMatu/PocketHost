import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {
  PackageManager,
  WorkspaceManager,
  WorkspaceBackupActions,
  RunitServiceActions,
  ResticActions,
} from '@/app/termux/admin-actions';

afterEach(() => vi.unstubAllGlobals());

describe('H3 confirmed operations, no password prerequisite', () => {
  it('shows cached update hints and exposes update checks without auto-upgrading', async () => {
    const user = userEvent.setup();
    const calls = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () =>
        options?.method === 'POST'
          ? { result: { exit: 0, output: 'Checked apt indexes' } }
          : {
              packages: [
                { name: 'curl', version: '8' },
                { name: 'git', version: '2' },
              ],
              truncated: false,
            },
    }));
    vi.stubGlobal('fetch', calls);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(
      <PackageManager
        summary={{
          installed: [],
          state: 'ok',
          observedAt: new Date().toISOString(),
          truncated: false,
          updates: { state: 'cached-unverified', candidates: ['curl'] },
        }}
      />,
    );
    await screen.findByRole('button', { name: 'curl' });
    expect(screen.getByText('Cached hint')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check updates' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'curl' }));
    expect(screen.getByText(/Cached update hint · verify/)).toBeTruthy();
    expect(calls.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Check updates' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    const posts = calls.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(String(call[1]?.body)));
    expect(posts).toEqual([{ action: 'package', name: 'refresh' }]);
  });

  it('requires a successful apt simulation before applying a selected package', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () =>
        options?.method === 'POST'
          ? { operation: 'install', result: { exit: 0, output: 'apt preview or applied' } }
          : { packages: [{ name: 'git', version: '2.50' }], truncated: false },
    }));
    const confirm = vi.fn(() => true);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirm);
    render(<PackageManager />);
    await user.click(await screen.findByRole('button', { name: 'git' }));
    expect(screen.queryByRole('button', { name: 'Apply previewed changes' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Preview removal' }));
    await screen.findByRole('button', { name: 'Apply previewed changes' });
    expect(confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply previewed changes' }));
    await screen.findByText('Operation completed · inventory refresh requested');
    const sent = fetchMock.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(String(call[1]?.body)));
    expect(sent).toEqual([
      { action: 'package-preview', name: 'remove', path: 'git' },
      { action: 'package', name: 'remove', path: 'git' },
    ]);
    expect(
      (
        fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')![1]?.headers as Record<
          string,
          string
        >
      )['X-PocketHost-Intent'],
    ).toBe('termux-admin');
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('reports a completed package operation without claiming its failed inventory refresh succeeded', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST')
        return { ok: true, json: async () => ({ result: { exit: 0, output: 'Applied' } }) };
      reads += 1;
      if (reads > 1) throw new Error('Inventory read failed');
      return {
        ok: true,
        json: async () => ({ packages: [{ name: 'curl', version: '8' }], truncated: false }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<PackageManager />);
    await user.click(await screen.findByRole('button', { name: 'curl' }));
    await user.click(screen.getByRole('button', { name: 'Preview removal' }));
    await user.click(await screen.findByRole('button', { name: 'Apply previewed changes' }));
    await screen.findByText('Operation completed · inventory refresh requested');
    await screen.findByText(/Termux inventory unavailable. Showing last successful result./);
    expect(reads).toBe(2);
    expect(screen.getByRole('button', { name: 'curl' })).toBeTruthy();
  });
  it('invalidates the preview when a different package is selected', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options?: RequestInit) => ({
        ok: true,
        json: async () =>
          options?.method === 'POST'
            ? { result: { exit: 0, output: 'Simulated' } }
            : {
                packages: [
                  { name: 'git', version: '2' },
                  { name: 'curl', version: '8' },
                ],
                truncated: false,
              },
      })),
    );
    render(<PackageManager />);
    await user.click(await screen.findByRole('button', { name: 'git' }));
    await user.click(screen.getByRole('button', { name: 'Preview removal' }));
    await screen.findByRole('button', { name: 'Apply previewed changes' });
    await user.click(screen.getByRole('button', { name: 'curl' }));
    expect(screen.queryByRole('button', { name: 'Apply previewed changes' })).toBeNull();
  });

  it('does not retry a mutation when its result is unconfirmed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        if (body.action === 'package') throw new TypeError('Network disconnected');
        return { ok: true, json: async () => ({ result: { exit: 0, output: 'Simulated' } }) };
      }
      return {
        ok: true,
        json: async () => ({ packages: [{ name: 'curl', version: '8' }], truncated: false }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<PackageManager />);
    await user.click(await screen.findByRole('button', { name: 'curl' }));
    await user.click(screen.getByRole('button', { name: 'Preview removal' }));
    await user.click(await screen.findByRole('button', { name: 'Apply previewed changes' }));
    await screen.findByText(/Result unconfirmed/);
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(2);
  });

  it('supports creating and saving a file in its separate workspace', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: url.length > 0,
      json: async () => (options?.method === 'POST' ? { changed: true } : { files: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<WorkspaceManager />);
    await screen.findByText('Workspace is empty.');
    await user.type(screen.getByLabelText('New workspace name'), 'note.md');
    await user.click(screen.getByRole('button', { name: 'New text file' }));
    await user.type(screen.getByLabelText('Workspace file editor'), 'test entry');
    await user.click(screen.getByRole('button', { name: 'Save file' }));
    await screen.findByText('save completed');
    const payloads = fetchMock.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(String(call[1]?.body)));
    expect(payloads).toContainEqual({
      action: 'file',
      name: 'save',
      path: 'note.md',
      content: 'test entry',
    });
  });

  it('creates and lists workspace backups without authentication prompts', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () =>
        options?.method === 'POST'
          ? {
              snapshot: {
                name: 'snapshot-20261107-aaaaaaaaaaaa',
                createdAt: '2026-11-07T13:00:00Z',
                files: 0,
              },
            }
          : { snapshots: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<WorkspaceBackupActions />);
    await user.click(screen.getByRole('button', { name: 'Create snapshot' }));
    await screen.findByText(/snapshot create completed/);
    const posted = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    expect(JSON.parse(String(posted?.[1]?.body))).toEqual({ action: 'snapshot', name: 'create' });
  });
});

describe('H3 additional native-tool integrations', () => {
  it('reports snapshot verification independently from restore', async () => {
    const user = userEvent.setup();
    const name = 'snapshot-20261107-aaaaaaaaaaaa';
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: _url.length > 0,
      json: async () =>
        options?.method === 'POST'
          ? { verification: { name, state: 'verified', files: 2 } }
          : { snapshots: [{ name, createdAt: '2026-11-07T13:00:00.000Z', files: 2 }] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<WorkspaceBackupActions />);
    await user.click(await screen.findByRole('button', { name: 'Verify' }));
    await screen.findByText(/Snapshot integrity: verified/);
    const posted = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')!;
    expect(JSON.parse(String(posted[1]?.body))).toEqual({
      action: 'snapshot',
      name: 'verify',
      path: name,
    });
  });
});

describe('H3 runit service enrollment UI', () => {
  it('refuses discovered service adoption but can create and start an attested fixed worker', async () => {
    const user = userEvent.setup();
    let created = false;
    let running = false;
    const requests = vi.fn(async (url: string, options?: RequestInit) => {
      expect(url).toContain('/api/v1/termux-admin');
      if (options?.method === 'POST') {
        const body = JSON.parse(String(options.body));
        if (!created) {
          expect(body).toEqual({
            action: 'service-create',
            name: 'heartbeat-worker-v1',
            path: 'site-worker',
          });
          created = true;
          return {
            ok: true,
            json: async () => ({
              changed: true,
              name: 'site-worker',
              template: 'heartbeat-worker-v1',
            }),
          };
        } else {
          expect(body).toEqual({
            action: 'service',
            name: 'start',
            path: 'site-worker',
          });
          running = true;
        }
        return { ok: true, json: async () => ({
          changed: true,
          result: { exit: 0, output: '' },
        }) };
      }
      return {
        ok: true,
        json: async () => ({
          archived: [],
          services: [
            {
              name: 'foreign-daemon',
              registered: false,
              protected: true,
              control: 'read-only',
              identity: 'unregistered',
              state: 'running',
              enabled: null,
            },
            ...(created
              ? [
                  {
                    name: 'site-worker',
                    registered: true,
                    protected: false,
                    control: 'standalone',
                    identity: 'verified',
                    identityReason: 'run-sha-attested',
                    template: 'heartbeat-worker-v1',
                    state: running ? 'running' : 'stopped',
                    enabled: false,
                  },
                ]
              : []),
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', requests);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(
      <MemoryRouter>
        <RunitServiceActions />
      </MemoryRouter>,
    );
    await screen.findByText('foreign-daemon');
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull();
    expect(screen.getByText(/No standalone workers yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    await user.type(screen.getByRole('textbox', { name: 'New service name' }), 'site-worker');
    await user.click(screen.getByRole('button', { name: 'Create stopped service' }));
    await screen.findByText('site-worker');
    expect(screen.getByText('Standalone · attested')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText(/site-worker: runit start confirmed running/);
    const actions = requests.mock.calls
      .filter((call: [string, RequestInit?]) => call[1]?.method === 'POST')
      .map((call: [string, RequestInit?]) => JSON.parse(String(call[1]?.body)));
    expect(actions.map((action: { action: string }) => action.action)).toEqual([
      'service-create',
      'service',
    ]);
    expect(actions.every((action: { path: string }) => action.path === 'site-worker')).toBe(true);
  });

  it('guides empty Services into the stopped-worker creator without sending a command', async () => {
    const user = userEvent.setup();
    const requests = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        archived: [],
        services: [
          { name: 'pockethost-panel', registered: false, protected: true,
            control: 'read-only', identity: 'reserved', state: 'running', enabled: true },
        ],
      }),
    }));
    vi.stubGlobal('fetch', requests);
    render(<MemoryRouter><RunitServiceActions /></MemoryRouter>);
    await screen.findByText('No standalone workers yet');
    await user.click(screen.getByRole('button', { name: 'Create standalone worker' }));
    expect(screen.getByLabelText('Add standalone service')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create stopped service' }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
  });

  it('blocks the worker creator when a previously verified inventory becomes unavailable', async () => {
    const user = userEvent.setup();
    let fail = false;
    const requests = vi.fn(async () => {
      if (fail) throw new Error('Inventory unavailable');
      return { ok: true, json: async () => ({ archived: [], services: [] }) };
    });
    vi.stubGlobal('fetch', requests);
    render(<MemoryRouter><RunitServiceActions /></MemoryRouter>);
    await screen.findByText('No standalone workers yet');
    await user.click(screen.getByRole('button', { name: 'Create standalone worker' }));
    await user.type(screen.getByRole('textbox', { name: 'New service name' }), 'safe-worker');
    expect((screen.getByRole('button', { name: 'Create stopped service' }) as HTMLButtonElement).disabled).toBe(false);
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Refresh services' }));
    await screen.findByText('Runit services unavailable');
    expect((screen.getByRole('button', { name: 'Create stopped service' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Service inventory unavailable/)).toBeTruthy();
    expect(requests.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
  });

  it('blocks duplicate or archived worker names before a create request', async () => {
    const user = userEvent.setup();
    const requests = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        archived: [{ name: 'old-worker', template: 'heartbeat-worker-v1', identity: 'restorable' }],
        services: [{ name: 'live-worker', registered: true, protected: false,
          control: 'standalone', identity: 'verified', state: 'stopped',
          identityReason: 'run-sha-attested', enabled: false, template: 'heartbeat-worker-v1' }],
      }),
    }));
    vi.stubGlobal('fetch', requests);
    render(<MemoryRouter><RunitServiceActions /></MemoryRouter>);
    await screen.findByText('live-worker');
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    const input = screen.getByRole('textbox', { name: 'New service name' });
    await user.type(input, 'old-worker');
    expect(screen.getByText(/already exists or is archived/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create stopped service' }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
  });

  it('revokes stale lifecycle controls when the service inventory refresh fails', async () => {
    const user = userEvent.setup();
    let unavailable = false;
    const requests = vi.fn(async () => {
      if (unavailable) throw new Error('Inventory transport unavailable');
      return {
        ok: true,
        json: async () => ({
          archived: [],
          services: [{
            name: 'stale-worker',
            registered: true,
            protected: false,
            control: 'standalone',
            identity: 'verified',
            identityReason: 'run-sha-attested',
            template: 'heartbeat-worker-v1',
            state: 'stopped',
            enabled: false,
          }],
        }),
      };
    });
    vi.stubGlobal('fetch', requests);
    render(<MemoryRouter><RunitServiceActions /></MemoryRouter>);
    await screen.findByText('stale-worker');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    unavailable = true;
    await user.click(screen.getByRole('button', { name: 'Refresh services' }));
    await screen.findByText('Runit services unavailable');
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByText('stale-worker')).toBeNull();
  });

  it('refuses lifecycle success without a confirmed runit command receipt', async () => {
    const user = userEvent.setup();
    const requests = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ changed: false, result: { exit: 0, output: '' } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          archived: [],
          services: [{
            name: 'receipt-worker',
            registered: true,
            protected: false,
            control: 'standalone',
            identity: 'verified',
            identityReason: 'run-sha-attested',
            template: 'heartbeat-worker-v1',
            state: 'stopped',
            enabled: false,
          }],
        }),
      };
    });
    vi.stubGlobal('fetch', requests);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<MemoryRouter><RunitServiceActions /></MemoryRouter>);
    await screen.findByText('receipt-worker');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Service result unconfirmed');
    expect(screen.queryByText(/runit start confirmed/)).toBeNull();
  });
});

describe('H3 unified package inventory', () => {
  it('shows one installed list, filters it and searches the apt catalog separately', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(options?.method).toBe('GET');
      return {
        ok: true,
        json: async () =>
          url.includes('mode=packages')
            ? { packages: [{ name: 'curl', version: '8.1' }], truncated: false }
            : {
                query: 'restic',
                packages: [{ name: 'restic', description: 'Encrypted backups' }],
                truncated: false,
              },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PackageManager />);
    await screen.findByRole('button', { name: 'curl' });
    expect(screen.getAllByLabelText('Search packages')).toHaveLength(1);
    await user.type(screen.getByLabelText('Search packages'), 'restic');
    await user.click(screen.getByRole('button', { name: 'Search catalog' }));
    await screen.findByText('Encrypted backups');
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(fetchMock.mock.calls.every((call) => call[1]?.method === 'GET')).toBe(true);
  });
});

describe('System UX distinctions', () => {
  it('separates installed package inventory from available catalog results', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes('mode=packages')
            ? { packages: [{ name: 'curl', version: '8.1' }], truncated: false }
            : {
                packages: [{ name: 'restic', description: 'Encrypted backups' }],
                truncated: false,
              },
      })),
    );
    render(<PackageManager />);
    await screen.findByRole('button', { name: 'curl' });
    await user.click(screen.getByRole('tab', { name: 'Available' }));
    expect(screen.queryByRole('button', { name: 'curl' })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Search packages' }), 'restic');
    await user.click(screen.getByRole('button', { name: 'Search catalog' }));
    await screen.findByText('Encrypted backups');
    await user.click(screen.getByRole('tab', { name: 'Installed' }));
    expect(await screen.findByRole('button', { name: 'curl' })).toBeTruthy();
    expect(screen.queryByText('Encrypted backups')).toBeNull();
  });

  it('prevents lifecycle actions for an attested worker with an unknown runtime state', async () => {
    const user = userEvent.setup();
    const calls = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        archived: [],
        services: [
          {
            name: 'site-worker',
            registered: true,
            protected: false,
            control: 'standalone',
            identity: 'verified',
            template: 'heartbeat-worker-v1',
            enabled: false,
            state: 'unknown',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', calls);
    render(
      <MemoryRouter>
        <RunitServiceActions />
      </MemoryRouter>,
    );
    await screen.findByText('site-worker');
    expect(screen.getByText(/Runtime state unknown/)).toBeTruthy();
    for (const name of ['Start', 'Stop', 'Restart']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    await user.click(screen.getByRole('button', { name: 'Refresh services' }));
    expect(calls.mock.calls).toHaveLength(2);
  });
});

describe('H3 native encrypted Restic backup UI', () => {
  it('backs up owned workspace through the typed endpoint without a password form', async () => {
    const user = userEvent.setup();
    let initialized = false;
    const calls = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        const payload = JSON.parse(String(opts.body));
        expect(payload).toEqual({ action: 'restic', name: 'backup' });
        initialized = true;
        return { ok: true, json: async () => ({ result: { exit: 0, output: 'mock done' } }) };
      }
      if (url.includes('mode=restic-snapshots'))
        return { ok: true, json: async () => ({ snapshots: [] }) };
      return {
        ok: true,
        json: async () => ({
          restic: { initialized, repositoryPresent: initialized, keyPresent: initialized },
        }),
      };
    });
    vi.stubGlobal('fetch', calls);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<ResticActions detected />);
    await screen.findByText('Repository not initialized');
    await user.click(screen.getByRole('button', { name: 'Create Restic backup' }));
    await screen.findByText('Restic backup completed');
    expect(calls.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true);
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
  it('makes missing Restic installation explicit without issuing commands', () => {
    const calls = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', calls);
    render(<ResticActions detected={false} />);
    expect(screen.getByText(/Restic executable not detected/)).toBeTruthy();
    expect(calls).not.toHaveBeenCalled();
  });
});
