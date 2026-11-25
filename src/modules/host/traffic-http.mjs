import { channel } from 'node:diagnostics_channel';

const observed = new WeakSet();

function payloadBytes(chunk, encoding) {
  if (typeof chunk === 'string')
    return Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
  return ArrayBuffer.isView(chunk) ? chunk.byteLength : 0;
}

/**
 * Observe only a finished HTTP response; no request-body listener, no buffering,
 * no socket interception. Bytes are response payload, excluding headers/framing.
 * HEAD and no-body status responses count as zero bytes.
 */
export function observeTrafficResponse(request, response, record, clock = Date.now) {
  if (observed.has(response) || typeof record !== 'function') return;
  observed.add(response);
  const originalWrite = response.write;
  const originalEnd = response.end;
  const route = request.url;
  let bytes = 0;
  let ending = false;
  function add(chunk, encoding) {
    try {
      bytes += payloadBytes(chunk, encoding);
    } catch {
      // Invalid app arguments are left to the original Node implementation.
    }
  }
  response.write = function (...args) {
    if (!ending) add(args[0], args[1]);
    return Reflect.apply(originalWrite, this, args);
  };
  response.end = function (...args) {
    if (!ending) add(args[0], args[1]);
    ending = true;
    return Reflect.apply(originalEnd, this, args);
  };
  response.once('finish', () => {
    try {
      const status = response.statusCode;
      const noBody = request.method === 'HEAD' || status < 200 || status === 204 || status === 304;
      record({ at: clock(), status, bytes: noBody ? 0 : bytes, path: route });
    } catch {
      // Collection must never change application response or process outcome.
    }
  });
}

/** Node Hosting hooks the native HTTP lifecycle only in its own launched process. */
export function subscribeTrafficHttp(port, record, clock = Date.now) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof record !== 'function')
    throw new Error('Invalid analytics HTTP scope');
  const requests = channel('http.server.request.start');
  const listener = ({ request, response }) => {
    try {
      if (request.socket.localPort !== port || request.url?.split('?', 1)[0] === '/__pockethost/ready')
        return;
      observeTrafficResponse(request, response, record, clock);
    } catch {
      // Unsupported or foreign HTTP response: leave application unchanged.
    }
  };
  requests.subscribe(listener);
  return () => requests.unsubscribe(listener);
}
