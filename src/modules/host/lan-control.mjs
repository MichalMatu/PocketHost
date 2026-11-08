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
 * Recover only listeners owned by this controller after an observable outage.
 * Never enumerate, adopt, or signal a gateway by PID or listening port.
 * Two independent failed health checks avoid recycling a live Wi-Fi session
 * for a brief network blip. A missing original interface blocks recovery.
 */
export function createLanRecovery({
  controller,
  interfaces = () => availableLanInterfaces(),
  check,
  failureThreshold = 2,
}) {
  if (typeof check !== 'function' ||
      !Number.isInteger(failureThreshold) || failureThreshold < 2) {
    throw new Error('invalid-lan-recovery');
  }
  let failedChecks = 0;
  let busy = false;
  return async function checkOwnedGateway() {
    if (busy) return controller.status();
    busy = true;
    try {
      const current = controller.status();
      if (!current.enabled || !current.bind ||
          !interfaces().some((item) => item.address === current.bind)) {
        failedChecks = 0;
        return current;
      }
      if (await check(current.bind)) {
        failedChecks = 0;
        return controller.status();
      }
      failedChecks += 1;
      if (failedChecks < failureThreshold) return controller.status();

      // Protect an owner's concurrent manual stop or interface switch.
      const recent = controller.status();
      if (!recent.enabled || recent.bind !== current.bind ||
          !interfaces().some((item) => item.address === current.bind)) {
        failedChecks = 0;
        return recent;
      }
      try {
        await controller.disable();
        await controller.enable(current.bind);
      } finally {
        failedChecks = 0;
      }
      return controller.status();
    } finally {
      busy = false;
    }
  };
}
