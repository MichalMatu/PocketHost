export declare function validateRemoteShellPayload(
  action: 'submit' | 'poll',
  body: unknown,
): { code: string; command: string } | { code: string; id: string };
