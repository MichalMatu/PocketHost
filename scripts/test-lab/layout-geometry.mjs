/** Browser-evaluable, metadata-only layout audit; no text, URLs or form values. */
export function inspectPageGeometry({ doc = globalThis.document, win = globalThis.window } = {}) {
  const width = win.innerWidth;
  let outside = 0;
  let smallControls = 0;
  let unlabeledControls = 0;
  const smallSamples = [];
  const overflowSamples = [];
  const unlabeledSamples = [];
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
      node.matches("button,a[href],[role='button']") &&
      !node.textContent?.trim() &&
      !['aria-label', 'aria-labelledby', 'title'].some((name) => node.getAttribute(name)?.trim()) &&
      !node.querySelector('[aria-label],[aria-labelledby],svg title,img[alt]:not([alt=""])')
    ) {
      unlabeledControls++;
      if (unlabeledSamples.length < 16) {
        unlabeledSamples.push({ ...sample(), icon: Boolean(node.querySelector('svg')) });
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
  // Wrapped horizontal tabs can obscure a panel without causing document overflow.
  let tabOverlapCases = 0;
  const tabOverlapSamples = [];
  for (const list of Array.from(doc.querySelectorAll('[role="tablist"]')).slice(0, 100)) {
    if (
      list.getAttribute('role') !== 'tablist' ||
      list.getAttribute('aria-orientation') === 'vertical'
    )
      continue;
    const bounds = list.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) continue;
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'))
      .map((tab) => ({ tab, rect: tab.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    if (!tabs.length) continue;
    const bottom = Math.max(...tabs.map(({ rect }) => rect.bottom));
    const selected = tabs.find(({ tab }) => tab.getAttribute('aria-selected') === 'true');
    const panelId = selected?.tab.getAttribute('aria-controls');
    const panel = panelId ? doc.getElementById(panelId) : null;
    const panelBounds = panel?.getBoundingClientRect();
    const listOverlap = bottom > bounds.bottom + 1;
    const panelOverlap = Boolean(
      panelBounds &&
      panelBounds.width > 0 &&
      panelBounds.height > 0 &&
      panelBounds.top >= bounds.top &&
      bottom > panelBounds.top + 1,
    );
    if (listOverlap || panelOverlap) {
      tabOverlapCases++;
      if (tabOverlapSamples.length < 16) {
        tabOverlapSamples.push({
          tabs: tabs.length,
          listOverlap,
          panelOverlap,
          listOverflowPx: Math.max(0, Math.round(bottom - bounds.bottom)),
        });
      }
    }
  }
  return {
    tabOverlapCases,
    tabOverlapSamples,
    horizontalOverflow: Math.max(0, doc.documentElement.scrollWidth - width),
    documentHeight: Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0),
    outOfBoundsElements: outside,
    overflowSamples,
    smallControls,
    smallSamples,
    unlabeledControls,
    unlabeledSamples,
  };
}
