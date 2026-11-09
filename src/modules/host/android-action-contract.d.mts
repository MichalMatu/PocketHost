export type AndroidAction =
  | 'launch'
  | 'force-stop'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'grant'
  | 'revoke'
  | 'process-stop'
  | 'service-start'
  | 'service-stop'
  | 'brightness'
  | 'timeout';

export interface AndroidActionPayload {
  action: AndroidAction;
  target: string;
  value: string;
}

export declare function validateAndroidActionPayload(body: unknown): AndroidActionPayload;
