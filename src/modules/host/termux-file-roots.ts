import { randomUUID } from 'node:crypto';
import {
  closeSync, constants, copyFileSync, existsSync, lstatSync,
  mkdirSync, openSync, readFileSync, readdirSync, realpathSync,
  renameSync, rmSync, rmdirSync, statSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type FileRoot = 'home' | 'prefix' | 'shared';
export type FileMutation = 'mkdir' | 'save' | 'copy' | 'move' | 'delete' | 'upload';
export interface FileEntry {
  name: string;
  kind: 'directory' | 'file' | 'link' | 'other';
  bytes: number;
}
const MAX_ENTRIES = 300;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_TRANSFER = 256 * 1024;
const MAX_DEPTH = 32;
const OWN_ROOTS: Record<FileRoot, string> = {
  home: os.homedir(),
  prefix: '/data/data/com.termux/files/usr',
  shared: path.join(os.homedir(), 'storage', 'shared'),
};

/** One root is chosen explicitly; request paths are always root-relative. */
export class TermuxFileRoots {
  constructor(privateRoots: Record<FileRoot, string> = OWN_ROOTS) {
    this.roots = privateRoots;
  }
  private readonly roots: Record<FileRoot, string>;

  available(): Array<{ id: FileRoot; available: boolean }> {
    return (['home', 'prefix', 'shared'] as const).map(id => {
      try { this.base(id); return { id, available: true }; }
      catch { return { id, available: false }; }
    });
  }
  private base(root: FileRoot): string {
    if (!Object.hasOwn(this.roots, root)) throw new RangeError('Unknown filesystem root');
    const candidate = this.roots[root];
    const actual = realpathSync(candidate);
    if (!statSync(actual).isDirectory()) throw new RangeError('Root unavailable');
    return actual;
  }
  private parts(relative: string): string[] {
    if (typeof relative !== 'string' || relative.length > 1024 ||
        relative.startsWith('/') || relative.includes('\\') ||
        relative.includes('\0')) throw new RangeError('Invalid relative path');
    if (relative === '') return [];
    const parts = relative.split('/');
    if (parts.length > MAX_DEPTH || parts.some(part =>
      !part || part === '.' || part === '..' || part.length > 255))
      throw new RangeError('Unsafe path segment');
    return parts;
  }
  private locate(root: FileRoot, relative: string, allowMissing = false): string {
    const parts = this.parts(relative);
    let current = this.base(root);
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]!);
      let stat: ReturnType<typeof lstatSync> | null = null;
      try { stat = lstatSync(current); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
      if (stat) {
        if (stat.isSymbolicLink()) throw new Error('Linked path refused');
        if (index < parts.length - 1 && !stat.isDirectory())
          throw new Error('Parent is not a directory');
      } else if (!allowMissing || index < parts.length - 1) {
        throw new Error('Path absent');
      }
    }
    return current;
  }
  list(root: FileRoot, relative = ''): { path: string; entries: FileEntry[]; truncated: boolean } {
    const dir = this.locate(root, relative);
    if (!lstatSync(dir).isDirectory()) throw new Error('Not a directory');
    const names = readdirSync(dir).sort();
    const entries: FileEntry[] = [];
    for (const name of names.slice(0, MAX_ENTRIES)) {
      const target = path.join(dir, name);
      try {
        const stat = lstatSync(target);
        entries.push({
          name,
          kind: stat.isSymbolicLink() ? 'link' : stat.isDirectory() ? 'directory' :
            stat.isFile() ? 'file' : 'other',
          bytes: stat.isFile() ? stat.size : 0,
        });
      } catch { /* Removed or inaccessible during traversal; do not invent metadata. */ }
    }
    return { path: relative, entries, truncated: names.length > MAX_ENTRIES };
  }
  readText(root: FileRoot, relative: string): { content: string; bytes: number } {
    if (!relative) throw new RangeError('File path required');
    const target = this.locate(root, relative);
    const stat = lstatSync(target);
    if (!stat.isFile() || stat.size > MAX_TEXT_BYTES) throw new Error('Text read limit exceeded');
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const contents = readFileSync(fd);
      if (contents.length > MAX_TEXT_BYTES || contents.includes(0)) throw new Error('Not a bounded text file');
      return { content: new TextDecoder('utf-8', { fatal: true }).decode(contents), bytes: contents.length };
    } finally { closeSync(fd); }
  }
  export(root: FileRoot, relative: string): { name: string; base64: string; bytes: number } {
    if (!relative) throw new RangeError('File path required');
    const target = this.locate(root, relative);
    const stat = lstatSync(target);
    if (!stat.isFile() || stat.size > MAX_TRANSFER) throw new Error('Transfer limit exceeded');
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = readFileSync(fd);
      if (bytes.length > MAX_TRANSFER) throw new Error('Transfer limit exceeded');
      return { name: path.basename(target), base64: bytes.toString('base64'), bytes: bytes.length };
    } finally { closeSync(fd); }
  }
  apply(
    root: FileRoot,
    operation: FileMutation,
    relative: string,
    payload: { destination?: string; content?: string; base64?: string } = {},
  ): { changed: true } {
    if (!relative) throw new RangeError('Root-level mutation denied');
    const target = this.locate(root, relative, operation === 'mkdir' ||
      operation === 'save' || operation === 'upload');
    switch (operation) {
      case 'mkdir':
        mkdirSync(target, { mode: 0o700 }); break;
      case 'save': {
        if (typeof payload.content !== 'string' ||
            Buffer.byteLength(payload.content) > MAX_TEXT_BYTES) throw new RangeError('Text file too large');
        if (existsSync(target) && !lstatSync(target).isFile()) throw new Error('Not a regular file');
        const temp = path.join(path.dirname(target), '.' + randomUUID() + '.tmp');
        writeFileSync(temp, payload.content, { flag: 'wx', mode: 0o600 });
        try { renameSync(temp, target); }
        catch (err) { rmSync(temp, { force: true }); throw err; }
        break;
      }
      case 'upload': {
        const value = payload.base64;
        if (typeof value !== 'string' || value.length > Math.ceil(MAX_TRANSFER / 3) * 4 ||
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
          throw new RangeError('Invalid upload encoding');
        const data = Buffer.from(value, 'base64');
        if (data.length > MAX_TRANSFER || data.toString('base64') !== value)
          throw new RangeError('Upload size or encoding invalid');
        writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
        break;
      }
      case 'copy':
      case 'move': {
        if (!payload.destination) throw new RangeError('Destination required');
        const destination = this.locate(root, payload.destination, true);
        if (existsSync(destination)) throw new Error('Destination already exists');
        if (operation === 'copy') {
          const st = lstatSync(target);
          if (!st.isFile() || st.size > MAX_TEXT_BYTES) throw new Error('Copy requires bounded file');
          copyFileSync(target, destination, constants.COPYFILE_EXCL);
        } else renameSync(target, destination);
        break;
      }
      case 'delete':
        if (lstatSync(target).isDirectory()) {
          if (readdirSync(target).length) throw new Error('Directory is not empty');
          rmdirSync(target);
        } else rmSync(target);
        break;
      default: throw new RangeError('Unknown file operation');
    }
    return { changed: true };
  }
}
