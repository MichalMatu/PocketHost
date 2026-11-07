import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalLaunchPlan, TermuxTerminal } from '../../src/modules/host/termux-terminal.ts';
import { admitsAgentCommand, OWNER_AGENT_CAPABILITIES } from '../../src/modules/host/termux-agent-contract.ts';

test('H3.4 ttyd launch plan binds one writable terminal exclusively to loopback', () => {
  const plan = terminalLaunchPlan();
  assert.equal(plan.executable, '/data/data/com.termux/files/usr/bin/ttyd');
  assert.deepEqual(plan.args.slice(0, 9), [
    '--interface', '127.0.0.1', '--port', '18798', '--writable', '--once',
    '--max-clients', '1', '--base-path',
  ]);
  assert.equal(plan.args[9], '/terminal');
  assert.equal(plan.port, 18798);
  assert.equal(plan.url, '/terminal/');
  assert.equal(plan.args.includes('--credential'), false);
  assert.equal(Object.hasOwn(plan.env, 'GITHUB_TOKEN'), false);
  assert.equal(plan.env.PATH, '/data/data/com.termux/files/usr/bin');
  assert.deepEqual(new TermuxTerminal().status(), { running: false, url: null });
});
test('H3.4 Local Agent non-browser calls require exact typed intent but no password', () => {
  const allowed = {
    intent: 'termux-admin',
    agentIntent: 'termux-owner-agent',
  };
  assert.equal(admitsAgentCommand(allowed), true);
  assert.equal(admitsAgentCommand({ ...allowed, fetchSite: 'cross-site' }), false);
  assert.equal(admitsAgentCommand({ ...allowed, origin: 'http://evil.example' }), false);
  assert.equal(admitsAgentCommand({ ...allowed, agentIntent: 'unknown' }), false);
  assert.equal(admitsAgentCommand({ ...allowed, intent: 'other' }), false);
  assert.equal(OWNER_AGENT_CAPABILITIES.loginRequired, false);
  assert.ok(OWNER_AGENT_CAPABILITIES.actions.includes('restic-system'));
  assert.ok(!OWNER_AGENT_CAPABILITIES.actions.includes('arbitrary-shell'));
});
