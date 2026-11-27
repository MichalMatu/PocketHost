import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPageGeometry } from '../../scripts/test-lab/layout-geometry.mjs';

function element({ left, right, width, height, slot = null, interactive = false, label = '' }) {
  return {
    tagName: interactive ? 'BUTTON' : 'DIV',
    textContent: label,
    getBoundingClientRect: () => ({ left, right, top: 12, width, height }),
    getAttribute: (name) => (name === 'data-slot' ? slot : null),
    parentElement: null,
    matches: () => interactive,
    querySelector: () => null,
  };
}

test('geometry captures bounded structural overflow without page text or URLs', () => {
  const nodes = [
    element({ left: 0, right: 80, width: 80, height: 40 }),
    element({ left: 375, right: 460, width: 85, height: 40, slot: 'wide-card' }),
    element({ left: -18, right: 20, width: 38, height: 40, slot: 'left-edge' }),
    element({
      left: 10,
      right: 29,
      width: 19,
      height: 20,
      interactive: true,
      label: 'Secret content',
    }),
    element({ left: 500, right: 520, width: 0, height: 20 }),
  ];
  const doc = {
    querySelectorAll: () => nodes,
    documentElement: { scrollWidth: 460, scrollHeight: 1400 },
    body: { scrollHeight: 1200 },
  };
  const value = inspectPageGeometry({ doc, win: { innerWidth: 390 } });
  assert.equal(value.horizontalOverflow, 70);
  assert.equal(value.documentHeight, 1400);
  assert.equal(value.outOfBoundsElements, 2);
  assert.deepEqual(
    value.overflowSamples.map((x) => [x.slot, x.side]),
    [
      ['wide-card', 'right'],
      ['left-edge', 'left'],
    ],
  );
  assert.equal(value.smallControls, 1);
  assert.equal(value.smallSamples[0].textLength, 'Secret content'.length);
  assert.equal(JSON.stringify(value).includes('Secret content'), false);
});

test('geometry bounds overflow samples to sixteen structural records', () => {
  const nodes = Array.from({ length: 100 }, () =>
    element({ left: 800, right: 900, width: 100, height: 40 }),
  );
  const doc = {
    querySelectorAll: () => nodes,
    documentElement: { scrollWidth: 900, scrollHeight: 1800 },
    body: { scrollHeight: 1800 },
  };
  const result = inspectPageGeometry({ doc, win: { innerWidth: 390 } });
  assert.equal(result.outOfBoundsElements, 100);
  assert.equal(result.overflowSamples.length, 16);
});

function tabFixture({ listBottom = 80, panelTop = 90, orientation = 'horizontal' } = {}) {
  const rect = (top, bottom) => ({
    left: 0,
    right: 300,
    top,
    bottom,
    width: 300,
    height: bottom - top,
  });
  const makeTab = (top, bottom, selected) => ({
    getBoundingClientRect: () => rect(top, bottom),
    getAttribute: (key) =>
      key === 'aria-selected'
        ? String(selected)
        : key === 'aria-controls'
          ? 'private-panel-id'
          : null,
  });
  const list = {
    getAttribute: (key) =>
      key === 'role' ? 'tablist' : key === 'aria-orientation' ? orientation : null,
    getBoundingClientRect: () => rect(10, listBottom),
    querySelectorAll: () => [makeTab(10, 40, true), makeTab(45, 75, false)],
  };
  return {
    doc: {
      querySelectorAll: (selector) => (selector === '[role="tablist"]' ? [list] : []),
      getElementById: () => ({ getBoundingClientRect: () => rect(panelTop, panelTop + 100) }),
      documentElement: { scrollWidth: 390, scrollHeight: 800 },
      body: { scrollHeight: 800 },
    },
    win: { innerWidth: 390 },
  };
}

test('detects wrapped tab overlap even when the document has no horizontal overflow', () => {
  const result = inspectPageGeometry(tabFixture({ listBottom: 40, panelTop: 50 }));
  assert.equal(result.horizontalOverflow, 0);
  assert.equal(result.tabOverlapCases, 1);
  assert.deepEqual(result.tabOverlapSamples, [
    { tabs: 2, listOverlap: true, panelOverlap: true, listOverflowPx: 35 },
  ]);
  assert.equal(JSON.stringify(result).includes('private-panel-id'), false);
});

test('accepts a correctly sized wrapped tablist and skips vertical tablists', () => {
  assert.equal(inspectPageGeometry(tabFixture()).tabOverlapCases, 0);
  assert.equal(
    inspectPageGeometry(tabFixture({ listBottom: 40, panelTop: 50, orientation: 'vertical' }))
      .tabOverlapCases,
    0,
  );
});
