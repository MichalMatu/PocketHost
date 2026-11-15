/**
 * Translate only known QA gate npm commands to direct pinned Node CLIs.
 * Android Termux has no /usr/bin/env, so npm's generated #! wrappers fail
 * even when packages are installed. This never drops a check or changes
 * packages; unsupported npm commands fail closed.
 */
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { TERMUX_DEPENDENCY_MANIFEST } from './termux-dependency-manifest.mjs';

export function resolveTermuxCheckCommand(check, checkoutRoot, nodePath, platform = process.platform) {
  if (!check || !['.', 'apps/admin'].includes(check.cwd) ||
      !Array.isArray(check.argv) || check.argv.some((arg) => typeof arg !== 'string')) {
    throw new Error('Invalid scoped QA command');
  }
  const [kind, ...args] = check.argv;
  if (platform !== 'android' || kind !== 'npm') {
    if (kind !== 'npm' && kind !== 'node') throw new Error('Unrecognized QA command');
    return { file: kind === 'node' ? nodePath : kind, args };
  }
  const tools = TERMUX_DEPENDENCY_MANIFEST.qaTools;
  let entry, directArgs;
  switch (check.label) {
    case 'root incremental typecheck':
      if (check.cwd !== '.' || args.join(' ') !==
          'run typecheck -- --incremental --tsBuildInfoFile .tmp/root-typecheck.tsbuildinfo')
        throw new Error('Unexpected root TypeScript check');
      entry = tools.rootTypecheck;
      directArgs = ['--noEmit', '--incremental', '--tsBuildInfoFile', '.tmp/root-typecheck.tsbuildinfo'];
      break;
    case 'admin incremental typecheck':
      if (check.cwd !== 'apps/admin' || args.join(' ') !==
          'exec --no -- tsc -b --pretty false')
        throw new Error('Unexpected admin TypeScript check');
      entry = tools.adminTypecheck;
      directArgs = ['-b', '--pretty', 'false'];
      break;
    case 'root changed-file lint':
      if (check.cwd !== '.' || args.slice(0, 3).join(' ') !== 'exec --no --' ||
          args[3] !== 'eslint' || args.length < 5 || args.slice(4).some((x) => !validRelative(x)))
        throw new Error('Unexpected root eslint arguments');
      entry = tools.rootLint;
      directArgs = args.slice(4);
      break;
    case 'admin changed-file lint':
      if (check.cwd !== 'apps/admin' || args.slice(0, 3).join(' ') !== 'exec --no --' ||
          args[3] !== 'eslint' || args.length < 5 || args.slice(4).some((x) => !validRelative(x)))
        throw new Error('Unexpected admin eslint arguments');
      entry = 'apps/admin/node_modules/eslint/bin/eslint.js';
      directArgs = args.slice(4);
      break;
    case 'changed markdown lint':
      if (check.cwd !== '.' || args.slice(0, 3).join(' ') !== 'exec --no --' ||
          args[3] !== 'markdownlint-cli2' || args.length < 5 ||
          args.slice(4).some((x) => !validRelative(x))) throw new Error('Unexpected markdownlint arguments');
      entry = tools.rootMarkdown;
      directArgs = args.slice(4);
      break;
    case 'changed-file format':
      if (check.cwd !== '.' || args.slice(0, 3).join(' ') !== 'exec --no --' ||
          args[3] !== 'prettier' || args[4] !== '--check' || args.length < 6 ||
          args.slice(5).some((x) => !validRelative(x))) throw new Error('Unexpected formatter arguments');
      entry = tools.rootFormat;
      directArgs = args.slice(4);
      break;
    case 'ui tests':
      if (check.cwd !== 'apps/admin' || args.slice(0, 3).join(' ') !== 'run test:ui --' ||
          args.length < 4 || args.slice(3).some((x) => !validRelative(x)))
        throw new Error('Unexpected UI test arguments');
      entry = tools.adminUI;
      directArgs = ['run', '--config', 'vitest.config.ts', ...args.slice(3)];
      break;
    default:
      throw new Error('Unsupported npm QA command: ' + String(check.label));
  }
  const root = path.resolve(checkoutRoot);
  const script = path.resolve(root, entry);
  if (!script.startsWith(root + path.sep) || !script.includes(path.sep + 'node_modules' + path.sep))
    throw new Error('QA script outside pinned dependencies');
  const stat = lstatSync(script);
  if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(script) !== script)
    throw new Error('Invalid pinned QA tool');
  return { file: nodePath, args: [script, ...directArgs] };
}

function validRelative(value) {
  return value.length > 0 && value.length <= 240 &&
    !value.startsWith('-') && !value.startsWith('/') && !value.includes('\\') &&
    value.split('/').every((part) => part && part !== '.' && part !== '..');
}
