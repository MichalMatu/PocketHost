/** Bound viewport capture offsets. A page without real scroll gets no duplicate screenshot. */
export function scrollCaptureTargets(documentHeight, viewportHeight) {
  if (!Number.isFinite(documentHeight) || !Number.isFinite(viewportHeight) ||
      documentHeight <= 0 || viewportHeight <= 0) {
    return { middle: null, bottom: null };
  }
  const distance = Math.max(0, Math.floor(documentHeight - viewportHeight));
  return {
    middle: distance > viewportHeight + 120 ? Math.round(distance / 2) : null,
    bottom: distance > 120 ? distance : null,
  };
}
