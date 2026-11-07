import assert from 'node:assert/strict';
import test from 'node:test';
import {
  admitOwnedStart,
  awaitOwnedReadiness,
  stopOwnedProcessSafely,
} from '../../src/modules/host/managed-process-supervisor.ts';

test('start admission refuses forged owner, stale marker, and occupied port', async () => {
  for (const change of [
    { approved: () => false },
    { noUnresolvedMarker: () => false },
    { portFree: async () => false },
  ]) {
    let calls = 0;
    const probe = {
      approved: () => {
        calls++;
        return true;
      },
      noUnresolvedMarker: () => true,
      portFree: async () => true,
      ...change,
    };
    await assert.rejects(admitOwnedStart(probe));
    assert.ok(calls <= 1);
  }
});

test('safe Stop never signals unverified or recycled PID', async () => {
  let signals = 0;
  await assert.rejects(
    stopOwnedProcessSafely({
      verifyOwnership: () => false,
      signalOwnedLeader: () => {
        signals++;
      },
      observe: async () => ({ leaderExited: true, portReleased: true, descendantsExited: true }),
      pause: async () => {},
    }),
    /Unverified/,
  );
  assert.equal(signals, 0);
});

test('safe Stop rejects orphan descendants, port leaks, and deadline exhaustion', async () => {
  for (const evidence of [
    { leaderExited: true, portReleased: true, descendantsExited: false },
    { leaderExited: true, portReleased: false, descendantsExited: true },
    { leaderExited: false, portReleased: true, descendantsExited: true },
  ]) {
    let signals = 0;
    let polls = 0;
    await assert.rejects(
      stopOwnedProcessSafely({
        verifyOwnership: () => true,
        signalOwnedLeader: () => {
          signals++;
        },
        observe: async () => {
          polls++;
          return evidence;
        },
        pause: async () => {},
        maxPolls: 3,
      }),
      /uncertain/,
    );
    assert.equal(signals, 1);
    assert.equal(polls, 3);
  }
});

test('safe Stop accepts only full exit evidence and signals once', async () => {
  let signals = 0;
  let polls = 0;
  await stopOwnedProcessSafely({
    verifyOwnership: () => true,
    signalOwnedLeader: () => {
      signals++;
    },
    observe: async () => {
      polls++;
      return { leaderExited: polls >= 2, portReleased: true, descendantsExited: true };
    },
    pause: async () => {},
    maxPolls: 3,
  });
  assert.equal(signals, 1);
  assert.equal(polls, 2);
});

test('readiness cannot promote PID reuse or non-healthy PRoot to running', async () => {
  await assert.rejects(
    awaitOwnedReadiness({
      identityMatches: () => false,
      health: async () => true,
      pause: async () => {},
      maxPolls: 2,
    }),
    /identity mismatch/,
  );
  let checks = 0;
  await assert.rejects(
    awaitOwnedReadiness({
      identityMatches: () => true,
      health: async () => {
        checks++;
        return false;
      },
      pause: async () => {},
      maxPolls: 2,
    }),
    /health timeout/,
  );
  assert.equal(checks, 2);
});

test('readiness accepts a verified and responsive owned application', async () => {
  let health = 0;
  await awaitOwnedReadiness({
    identityMatches: () => true,
    health: async () => ++health === 2,
    pause: async () => {},
    maxPolls: 3,
  });
  assert.equal(health, 2);
});

test('invalid polling limits fail before any process signal', async () => {
  let calls = 0;
  await assert.rejects(
    stopOwnedProcessSafely({
      verifyOwnership: () => true,
      signalOwnedLeader: () => {
        calls++;
      },
      observe: async () => ({ leaderExited: true, portReleased: true, descendantsExited: true }),
      pause: async () => {},
      maxPolls: 0,
    }),
    RangeError,
  );
  assert.equal(calls, 0);
});
