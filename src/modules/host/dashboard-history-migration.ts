/** Discard retired external service identifiers from persisted telemetry, not live services. */
export function filterUnknownServices(value: unknown, allowed: readonly string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const document = { ...value } as Record<string, unknown>;
  for (const key of ['points', 'archive']) {
    const entries = document[key];
    if (!Array.isArray(entries)) continue;
    document[key] = entries.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const point = item as Record<string, unknown>;
      const states = point.serviceStates;
      if (!states || typeof states !== 'object' || Array.isArray(states)) return item;
      return {
        ...point,
        serviceStates: Object.fromEntries(
          Object.entries(states).filter(([id]) => allowed.includes(id)),
        ),
      };
    });
  }
  if (Array.isArray(document.events))
    document.events = document.events.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
      const service = (item as Record<string, unknown>).service;
      return typeof service !== 'string' || allowed.includes(service);
    });
  return document;
}
