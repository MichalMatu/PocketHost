/** Metadata-only comparison of equivalent visual slots; never returns page text. */
export function inspectCompositionGeometry({
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  const root = doc.querySelector('[data-slot="sidebar-inset"]');
  if (!root) return null;
  const shell = root.getBoundingClientRect();
  const header = root.querySelector(':scope > header');
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = win.getComputedStyle(node);
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      !header?.contains(node)
    );
  };
  const round = (number) => Math.round(number * 10) / 10;
  const vector = (node) => {
    const rect = node.getBoundingClientRect();
    const style = win.getComputedStyle(node);
    const svg = node.querySelector('svg')?.getBoundingClientRect();
    return {
      box: [
        round(rect.left - shell.left),
        round(rect.top - shell.top),
        round(rect.width),
        round(rect.height),
      ],
      type: [style.fontSize, style.fontWeight, style.lineHeight],
      spacing: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
        style.rowGap,
        style.columnGap,
      ],
      surface: [
        style.backgroundColor,
        style.color,
        style.borderTopWidth,
        style.borderTopColor,
        style.borderTopLeftRadius,
        style.boxShadow,
      ],
      alignment: [style.display, style.alignItems, style.justifyContent],
      icon: svg ? [round(svg.width), round(svg.height)] : null,
    };
  };
  const select = (selector) => Array.from(root.querySelectorAll(selector)).filter(visible);
  const collect = (nodes) => {
    const signatures = new Map();
    for (const node of nodes) {
      const value = vector(node);
      const signature = JSON.stringify({
        height: value.box[3],
        type: value.type,
        spacing: value.spacing,
        surface: value.surface,
        alignment: value.alignment,
        icon: value.icon,
      });
      signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
    }
    return {
      count: nodes.length,
      signatures: signatures.size,
      samples: nodes.slice(0, 8).map(vector),
    };
  };
  const headings = select('h1,h2,h3,[aria-hidden="true"].text-xl');
  const titles = select('h1');
  const buttons = select('button,[data-slot="button"],a.group\\/button');
  const refresh = buttons.filter((node) => node.textContent?.trim() === 'Refresh');
  const roles = {
    headings: collect(headings),
    titles: collect(titles),
    refresh: collect(refresh),
    buttons: collect(buttons),
    cards: collect(select('[data-slot="card"]')),
    cardHeaders: collect(select('[data-slot="card-header"]')),
    cardTitles: collect(select('[data-slot="card-title"]')),
    cardContent: collect(select('[data-slot="card-content"]')),
    fields: collect(select('input,select,textarea,[data-slot="select-trigger"]')),
    tabs: collect(select('[role="tablist"]')),
    rows: collect(select('tr,[data-slot="table-row"]')),
    dialogs: collect(select('[role="dialog"]')),
  };
  return {
    viewport: [win.innerWidth, win.innerHeight],
    shell: [round(shell.left), round(shell.top), round(shell.width)],
    hiddenH1: root.querySelectorAll('h1').length - titles.length,
    roles,
  };
}
