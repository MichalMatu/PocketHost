import { timingSafeEqual } from 'node:crypto';

export function nodeOwnerAccess(mode: string | undefined, secret: string) {
  const configured = /^[A-Za-z0-9_-]{32,128}$/.test(secret);
  const trusted = mode === 'trusted-lan';
  const validMode = trusted || mode === undefined || mode === 'protected';
  return {
    mode: trusted ? 'trusted-lan' : 'protected',
    configured,
    authorized(submitted: unknown): boolean {
      if (!validMode) return false;
      if (trusted) return true;
      return (
        configured &&
        typeof submitted === 'string' &&
        /^[A-Za-z0-9_-]{32,128}$/.test(submitted) &&
        submitted.length === secret.length &&
        timingSafeEqual(Buffer.from(submitted, 'ascii'), Buffer.from(secret, 'ascii'))
      );
    },
  };
}
