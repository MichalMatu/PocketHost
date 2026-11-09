/**
 * Exact, bounded browser shell command contract. The direct Run action is
 * user intent; Android itself enforces the Shizuku shell/root capability.
 */
export function validateRemoteShellPayload(action, body) {
  if (action !== 'run' || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid-remote-shell-request');
  }
  if (
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, 'command') ||
    typeof body.command !== 'string' ||
    !body.command.trim() ||
    body.command.length > 240 ||
    body.command.includes('\0')
  ) {
    throw new Error('invalid-shell-command');
  }
  return { command: body.command };
}
