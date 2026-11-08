/**
 * Browser-to-Companion remote shell envelope. A code only submits a request:
 * every exact command must still be approved in the foreground phone UI.
 */
export function validateRemoteShellPayload(action, body) {
  if (!['submit', 'poll'].includes(action) ||
      !body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid-remote-shell-request');
  }
  if (typeof body.code !== 'string' || !/^\d{10}$/.test(body.code)) {
    throw new Error('invalid-pairing-code');
  }
  const keys = Object.keys(body).sort().join(',');
  if (action === 'submit') {
    if (keys !== 'code,command' || typeof body.command !== 'string' ||
        !body.command.trim() || body.command.length > 240 ||
        body.command.includes('\0')) throw new Error('invalid-shell-command');
    return { code: body.code, command: body.command };
  }
  if (keys !== 'code,id' || typeof body.id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(body.id)) {
    throw new Error('invalid-shell-request-id');
  }
  return { code: body.code, id: body.id };
}
