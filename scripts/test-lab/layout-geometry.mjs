/** Browser-evaluable, metadata-only layout audit; no text, URLs or form values. */
export function inspectPageGeometry({ doc = globalThis.document, win = globalThis.window } = {}) {
  const width = win.innerWidth;
  let outside = 0;
  let smallControls = 0;
  const smallSamples = [];
  const overflowSamples = [];
  for (const node of Array.from(doc.querySelectorAll('body *')).slice(0, 5000)) {
    const r = node.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0) continue;
    const sample = () => ({
      tag: node.tagName.toLowerCase(),
      slot: node.getAttribute('data-slot')?.slice(0, 40) ?? null,
      parentSlot: node.parentElement?.getAttribute('data-slot')?.slice(0, 40) ?? null,
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
    if (r.left < -2 || r.right > width + 2) {
      outside++;
      if (overflowSamples.length < 16) {
        overflowSamples.push({
          ...sample(),
          side: r.left < -2 ? 'left' : 'right',
        });
      }
    }
    if (
      node.matches("a,button,input,select,textarea,[role='button']") &&
      (r.width < 32 || r.height < 32)
    ) {
      smallControls++;
      if (smallSamples.length < 24) {
        smallSamples.push({
          ...sample(),
          icon: Boolean(node.querySelector('svg')),
          textLength: Math.min(node.textContent?.trim().length ?? 0, 100),
        });
      }
    }
  }
  return {
    horizontalOverflow: Math.max(0, doc.documentElement.scrollWidth - width),
    documentHeight: Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0),
    outOfBoundsElements: outside,
    overflowSamples,
    smallControls,
    smallSamples,
  };
}
