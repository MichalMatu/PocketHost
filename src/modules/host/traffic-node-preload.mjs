// Only the existing owned Node run script opts into this module.
try {
  const { POCKETHOST_TRAFFIC_ID: id, POCKETHOST_TRAFFIC_ROOT: root, PORT } = process.env;
  if (/^node-[a-f0-9]{32}$/.test(id ?? '') && root && /^\d+$/.test(PORT ?? '')) {
    const { createTrafficRecorder } = await import('./traffic-store.mjs');
    const { subscribeTrafficHttp } = await import('./traffic-http.mjs');
    const recorder = createTrafficRecorder(root, id);
    if (recorder) subscribeTrafficHttp(Number(PORT), recorder.record);
  }
} catch {
  // Missing storage or unsupported instrumentation must never stop the application.
}
