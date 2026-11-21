import path from 'node:path';
import type { WorkerTemplate } from './termux-service-admin.ts';

/** Preserve exact installed script bytes; SHA-256 ownership depends on them. */
export const PREFIX = '/data/data/com.termux/files/usr';
export const SERVICE_NAME = /^[a-z][a-z0-9-]{1,63}$/;
type StagedWorkerTemplate = 'python-source-v1' | 'node-source-v1';
export const isStagedWorker = (template: WorkerTemplate): template is StagedWorkerTemplate =>
  template === 'python-source-v1' || template === 'node-source-v1';

/**
 * Fixed, exact source identity for both available standalone templates.
 * This function is the allowed execution policy, not merely a display
 * label; recovery re-computes the same SHA-256 before re-enrollment.
 */
export function builtinWorkerRunScript(template: WorkerTemplate, target: string): string {
  if (
    !['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1', 'node-source-v1'].includes(
      template,
    )
  )
    throw new RangeError('Invalid builtin worker');
  if (target !== path.join(PREFIX, 'var', 'sv', path.basename(target)))
    throw new Error('Unexpected builtin target path');
  const sh = path.join(PREFIX, 'bin', 'sh');
  const env = path.join(PREFIX, 'bin', 'env');
  const runtime = path.join(
    PREFIX,
    'bin',
    template === 'python-heartbeat-v1' || template === 'python-source-v1' ? 'python' : 'node',
  );
  if (isStagedWorker(template))
    return (
      '#!' +
      sh +
      '\nexec ' +
      env +
      ' -i PATH=' +
      path.join(PREFIX, 'bin') +
      ' HOME=' +
      target +
      ' TMPDIR=' +
      path.join(PREFIX, 'tmp') +
      ' ' +
      runtime +
      (template === 'python-source-v1' ? ' -I -u ' : ' ') +
      path.join(target, template === 'python-source-v1' ? 'worker.py' : 'worker.mjs') +
      '\n'
    );
  const code =
    template === 'python-heartbeat-v1'
      ? 'import time\nprint("PocketHost Python worker started", flush=True)\nwhile True:\n    time.sleep(60)\n    print("PocketHost Python worker heartbeat", flush=True)'
      : 'console.log("PocketHost Node worker started"); setInterval(() => console.log("PocketHost Node worker heartbeat"), 60000)';
  return (
    '#!' +
    sh +
    '\nexec ' +
    env +
    ' -i PATH=' +
    path.join(PREFIX, 'bin') +
    ' HOME=' +
    target +
    ' TMPDIR=' +
    path.join(PREFIX, 'tmp') +
    ' ' +
    runtime +
    (template === 'python-heartbeat-v1' ? ' -I -u -c ' : ' -e ') +
    "'" +
    code +
    "'\n"
  );
}

/**
 * Runit's log child executes its own script. Reattest this exact fixed
 * source as well: verifying only the main run script is insufficient.
 */
export function builtinWorkerLogScript(name: string): string {
  valid(name);
  const sh = path.join(PREFIX, 'bin', 'sh');
  const svlogd = path.join(PREFIX, 'bin', 'svlogd');
  const logTarget = path.join(PREFIX, 'var', 'log', 'sv', name);
  return '#!' + sh + '\nexec ' + svlogd + ' -tt ' + logTarget + '\n';
}

export function valid(name: string): void {
  if (typeof name !== 'string' || !SERVICE_NAME.test(name))
    throw new RangeError('Invalid runit service name');
}

