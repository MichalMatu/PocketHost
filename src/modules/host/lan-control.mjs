import os from 'node:os';
import net from 'node:net';
import { startLanGateway } from './lan-gateway.mjs';

/** Only exact private addresses assigned to this host are selectable. */
export function availableLanInterfaces(interfaces = os.networkInterfaces()) {
  return Object.entries(interfaces)
    .flatMap(([name, entries]) =>
      (entries ?? [])
        .filter(
          (item) =>
            item.family === 'IPv4' &&
            !item.internal &&
            net.isIP(item.address) === 4 &&
            (item.address.startsWith('10.') ||
              item.address.startsWith('192.168.') ||
              /^172\.(1[6-9]|2\d|3[01])\./.test(item.address)),
        )
        .map((item) => ({ name, address: item.address })),
    )
    .sort((a, b) => a.address.localeCompare(b.address));
}

/**
 * One Vite session owns only gateways it created itself.
 * Never inspect or signal an arbitrary process using a port or PID.
 */
export function createLanControl({
  interfaces = () => availableLanInterfaces(),
  start = (bind) => startLanGateway(bind, { registerSignals: false }),
  mode = 'manual',
} = {}) {
  let gateway = null;
  let inFlight = false;
  const status = () => ({
    version: 1,
    mode,
    enabled: gateway !== null,
    bind: gateway?.bind ?? null,
    interfaces: interfaces(),
    adminUrl: gateway ? 'http://' + gateway.bind + ':18878/' : null,
    siteUrl: gateway ? 'http://' + gateway.bind + ':18879/' : null,
  });
  async function enable(bind) {
    if (inFlight) throw new Error('busy');
    if (typeof bind !== 'string' || !interfaces().some((item) => item.address === bind)) {
      throw new Error('invalid-lan-interface');
    }
    if (gateway) {
      if (gateway.bind !== bind) throw new Error('disable-before-switch');
      return status();
    }
    inFlight = true;
    try {
      const instance = await start(bind);
      gateway = { bind, close: instance.close };
      return status();
    } finally {
      inFlight = false;
    }
  }
  async function disable() {
    if (inFlight) throw new Error('busy');
    if (!gateway) return status();
    const instance = gateway;
    inFlight = true;
    try {
      await instance.close();
      gateway = null;
    } finally {
      inFlight = false;
    }
    return status();
  }
  return { status, enable, disable };
}

/**
 * Recover ONLY an owned gateway. A missing interface is treated as an
 * outage too: after two observations, release the stale owner listeners
 * so the outer session may bind a newly assigned Wi-Fi IP.
 *
 * Delayed, exponential recovery prevents a flapping radio from causing
 * an endless close/listen loop. An owner stop always takes precedence.
 */
export function createLanRecovery({
  controller,
  interfaces = () => availableLanInterfaces(),
  check,
  canRecover = () => true,
  failureThreshold = 2,
  cooldownMs = 30000,
  maxCooldownMs = 300000,
  now = () => Date.now(),
}) {
  if (
    typeof check !== 'function' ||
    typeof canRecover !== 'function' ||
    !Number.isInteger(failureThreshold) ||
    failureThreshold < 2 ||
    !Number.isInteger(cooldownMs) ||
    cooldownMs < 0 ||
    !Number.isInteger(maxCooldownMs) ||
    maxCooldownMs < cooldownMs
  ) {
    throw new Error('invalid-lan-recovery');
  }
  let failedChecks = 0;
  let busy = false;
  let state = 'unknown';
  let checkedAt = null;
  let recoveredAt = null;
  let nextRecoveryTime = 0;
  let recoveries = 0;
  let attemptsSinceHealthy = 0;
  let lastError = null;

  function health() {
    return {
      state: !controller.status().enabled ? 'disabled' : state,
      checkedAt,
      recoveredAt,
      consecutiveFailures: failedChecks,
      recoveryCount: recoveries,
      nextRecoveryAt: nextRecoveryTime ? new Date(nextRecoveryTime).toISOString() : null,
      lastError,
    };
  }

  async function checkOwnedGateway() {
    if (busy) return controller.status();
    busy = true;
    try {
      const current = controller.status();
      if (!current.enabled || !current.bind || !canRecover()) {
        failedChecks = 0;
        state = current.enabled ? 'paused' : 'disabled';
        return current;
      }
      const addressPresent = interfaces().some((item) => item.address === current.bind);
      let working = false;
      if (addressPresent) {
        try {
          working = (await check(current.bind)) === true;
        } catch {
          lastError = 'probe-error';
        }
      }
      checkedAt = new Date(now()).toISOString();
      if (working) {
        failedChecks = 0;
        attemptsSinceHealthy = 0;
        nextRecoveryTime = 0;
        lastError = null;
        state = 'healthy';
        return controller.status();
      }
      failedChecks += 1;
      state = addressPresent ? 'unhealthy' : 'interface-missing';
      if (!lastError || !addressPresent) {
        lastError = addressPresent ? 'probe-failed' : 'interface-missing';
      }
      if (failedChecks < failureThreshold || now() < nextRecoveryTime) {
        return controller.status();
      }
      const recent = controller.status();
      if (
        !canRecover() ||
        !recent.enabled ||
        recent.bind !== current.bind ||
        (addressPresent && !interfaces().some((item) => item.address === current.bind))
      ) {
        failedChecks = 0;
        return recent;
      }
      attemptsSinceHealthy += 1;
      const delay = Math.min(
        maxCooldownMs,
        cooldownMs * 2 ** Math.min(attemptsSinceHealthy - 1, 8),
      );
      nextRecoveryTime = now() + delay;
      failedChecks = 0;
      try {
        await controller.disable();
        if (addressPresent && canRecover()) {
          await controller.enable(current.bind);
        }
        recoveredAt = new Date(now()).toISOString();
        recoveries += 1;
        state = addressPresent ? 'recovering' : 'awaiting-interface';
        lastError = null;
      } catch {
        state = 'unhealthy';
        lastError = 'owned-recovery-failed';
      }
      return controller.status();
    } finally {
      busy = false;
    }
  }
  checkOwnedGateway.health = health;
  return checkOwnedGateway;
}
