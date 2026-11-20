import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  username: string;
  port: number;
}
type Input = Omit<SSHConnection, 'id'>;
const HOST = /^(?:[A-Za-z0-9](?:[A-Za-z0-9._-]{0,251}[A-Za-z0-9])?)$/;
const USER = /^[A-Za-z_][A-Za-z0-9_.-]{0,31}$/;
const NAME = /^[^\r\n\x00-\x1f]{1,48}$/;
const ID = /^[a-f0-9-]{36}$/;
const MAX = 24;

/** Persist only SSH connection names, not keys or credentials. */
export class SSHConnectionsHost {
  private readonly file: string;
  constructor(home = os.homedir()) {
    this.file = path.join(home, '.local/state/pockethost/ssh-connections.json');
  }
  list(): SSHConnection[] {
    if (!existsSync(this.file)) return [];
    const raw = readFileSync(this.file, 'utf8');
    if (raw.length > 16000) throw Error('invalid-ssh-profiles');
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > MAX) throw Error('invalid-ssh-profiles');
    const ids = new Set<string>();
    return data.map(x => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error('invalid-ssh-profile');
      const p = x as Record<string, unknown>;
      if (typeof p.id !== 'string' || !ID.test(p.id) ||
          typeof p.name !== 'string' || !NAME.test(p.name) ||
          typeof p.host !== 'string' || !HOST.test(p.host) ||
          typeof p.username !== 'string' || !USER.test(p.username) ||
          !Number.isInteger(p.port) || Number(p.port) < 1 || Number(p.port) > 65535 ||
          ids.has(p.id)) throw Error('invalid-ssh-profile');
      ids.add(p.id);
      return { id: p.id, name: p.name, host: p.host, username: p.username,
        port: Number(p.port) };
    });
  }
  private write(items: SSHConnection[]): void {
    const dir = path.dirname(this.file);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(dir, '.ssh-profiles-' + randomUUID());
    writeFileSync(tmp, JSON.stringify(items, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(tmp, this.file);
  }
  save(input: unknown, id?: string): SSHConnection[] {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('bad-ssh-profile');
    const v = input as Record<string, unknown>;
    if (Object.keys(v).sort().join(',') !== 'host,name,port,username') throw Error('bad-ssh-profile-fields');
    const p: Input = {
      name: String(v.name ?? '').trim(), host: String(v.host ?? '').trim(),
      username: String(v.username ?? '').trim(), port: Number(v.port),
    };
    if (!NAME.test(p.name) || !HOST.test(p.host) || !USER.test(p.username) ||
        !Number.isInteger(p.port) || p.port < 1 || p.port > 65535)
      throw Error('invalid-ssh-profile');
    const all = this.list();
    if (id !== undefined) {
      const index = all.findIndex(item => item.id === id);
      if (index < 0) throw Error('missing-ssh-profile');
      all[index] = { ...p, id };
    } else {
      if (all.length >= MAX) throw Error('ssh-profile-limit');
      all.push({ ...p, id: randomUUID() });
    }
    this.write(all);
    return all;
  }
  delete(id: string): SSHConnection[] {
    if (!ID.test(id)) throw Error('bad-ssh-profile-id');
    const all = this.list();
    if (!all.some(p => p.id === id)) throw Error('missing-ssh-profile');
    const remaining = all.filter(p => p.id !== id);
    this.write(remaining);
    return remaining;
  }
  find(id: string): SSHConnection {
    const p = this.list().find(x => x.id === id);
    if (!p) throw Error('missing-ssh-profile');
    return p;
  }
}
