import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndroidActionPayload } from '../../src/modules/host/android-action-contract.mjs';

test('typed Android actions preserve real owner target and value', () => {
  const approved = [
    ['launch', 'com.example.app', ''],
    ['force-stop', 'com.example.app', ''],
    ['enable', 'com.example.app', ''],
    ['disable', 'com.example.app', ''],
    ['uninstall', 'com.example.app', ''],
    ['grant', 'com.example.app', 'android.permission.CAMERA'],
    ['revoke', 'com.example.app', 'android.permission.CAMERA'],
    ['process-stop', '1', ''],
    ['process-stop', '99999', ''],
    ['service-start', 'com.example/.Worker', ''],
    ['service-stop', 'com.example/.Worker', ''],
    ['brightness', '', '0'],
    ['brightness', '', '255'],
    ['timeout', '', '15000'],
    ['timeout', '', '3600000'],
  ];
  for (const [action, target, value] of approved) {
    assert.deepEqual(validateAndroidActionPayload({ action, target, value }), {
      action,
      target,
      value,
    });
  }
});
test('typed Android bridge rejects malformed or command-injected envelopes, not shell categories', () => {
  const invalid = [
    null,
    [],
    {},
    { action: 'shell', target: 'id', value: '' },
    { action: 'launch', target: 'com.example.app', value: '', extra: true },
    { action: 'launch', target: 'com.example.app;echo hi', value: '' },
    { action: 'launch', target: 'com.example.app', value: 'other' },
    { action: 'grant', target: 'com.example.app', value: 'android.permission.X;whoami' },
    { action: 'process-stop', target: '0', value: '' },
    { action: 'process-stop', target: '-1', value: '' },
    { action: 'service-start', target: 'bad;component', value: '' },
    { action: 'brightness', target: '', value: '256' },
    { action: 'timeout', target: '', value: '14000' },
    { action: 'timeout', target: '', value: '3600001' },
  ];
  for (const body of invalid) assert.throws(() => validateAndroidActionPayload(body));
});
