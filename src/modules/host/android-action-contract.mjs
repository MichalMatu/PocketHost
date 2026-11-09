/**
 * Typed user-initiated Android operations. Advanced Shell remains the
 * intentionally unrestricted command interface; this envelope prevents
 * ambiguous targets, accidental inputs and argument injection.
 */
const PACKAGE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;
const COMPONENT = /^[A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+$/;
const packageActions = new Set(['launch', 'force-stop', 'enable', 'disable', 'uninstall']);
const permissionActions = new Set(['grant', 'revoke']);
const serviceActions = new Set(['service-start', 'service-stop']);

export function validateAndroidActionPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'action,target,value' ||
      typeof body.action !== 'string' || typeof body.target !== 'string' ||
      typeof body.value !== 'string' || body.target.length > 240 ||
      body.value.length > 240) {
    throw new TypeError('invalid-android-action-payload');
  }
  const { action, target, value } = body;
  if (packageActions.has(action)) {
    if (!PACKAGE.test(target) || target.length > 200 || value !== '') throw new TypeError('invalid-android-package');
  } else if (permissionActions.has(action)) {
    if (!PACKAGE.test(target) || target.length > 200 ||
        !PACKAGE.test(value) || value.length > 200) throw new TypeError('invalid-android-permission');
  } else if (serviceActions.has(action)) {
    if (!COMPONENT.test(target) || target.length > 200 || value !== '') throw new TypeError('invalid-android-service');
  } else if (action === 'process-stop') {
    if (!/^[1-9][0-9]{0,6}$/.test(target) || value !== '') throw new TypeError('invalid-android-process');
  } else if (action === 'brightness') {
    if (target !== '' || !/^[0-9]{1,3}$/.test(value) || Number(value) > 255) throw new TypeError('invalid-android-brightness');
  } else if (action === 'timeout') {
    if (target !== '' || !/^[0-9]{4,8}$/.test(value) ||
        Number(value) < 15000 || Number(value) > 3600000) throw new TypeError('invalid-android-timeout');
  } else {
    throw new TypeError('unknown-android-action');
  }
  return { action, target, value };
}
