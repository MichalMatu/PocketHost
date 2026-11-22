import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPageGeometry } from '../../scripts/test-lab/layout-geometry.mjs';

function control({ tag = 'BUTTON', text = '', attrs = {}, descendantLabel = false, svg = true } = {}) {
  return {
    tagName: tag,
    textContent: text,
    parentElement: null,
    getBoundingClientRect: () => ({
      left: 2,
      right: 42,
      top: 12,
      width: 40,
      height: 40,
    }),
    getAttribute: (name) => attrs[name] ?? null,
    matches: (selector) =>
      selector === "button,a[href],[role='button']"
        ? tag === 'BUTTON' || tag === 'A'
        : ['BUTTON', 'A', 'INPUT'].includes(tag),
    querySelector: (selector) =>
      selector === 'svg' ? (svg ? {} : null) : descendantLabel ? {} : null,
  };
}

function documentWith(nodes) {
  return {
    querySelectorAll: () => nodes,
    documentElement: { scrollWidth: 390, scrollHeight: 844 },
    body: { scrollHeight: 844 },
  };
}

test('geometry identifies unlabeled icon controls without recording page content', () => {
  const nodes = [
    control(),
    control({ tag: 'A' }),
    control({ text: 'Search' }),
    control({ attrs: { 'aria-label': 'Open settings' } }),
    control({ attrs: { title: 'Help' } }),
    control({ attrs: { 'aria-labelledby': 'external-label' } }),
    control({ descendantLabel: true }),
    control({ tag: 'INPUT' }),
  ];
  const result = inspectPageGeometry({
    doc: documentWith(nodes),
    win: { innerWidth: 390 },
  });
  assert.equal(result.unlabeledControls, 2);
  assert.deepEqual(
    result.unlabeledSamples.map((sample) => sample.tag),
    ['button', 'a'],
  );
  assert.equal(result.unlabeledSamples[0].icon, true);
  assert.equal(JSON.stringify(result).includes('Open settings'), false);
  assert.equal(JSON.stringify(result).includes('external-label'), false);
  assert.equal(JSON.stringify(result).includes('Search'), false);
});

test('unlabeled control samples stay bounded while total remains accurate', () => {
  const nodes = Array.from({ length: 45 }, () => control());
  const result = inspectPageGeometry({
    doc: documentWith(nodes),
    win: { innerWidth: 390 },
  });
  assert.equal(result.unlabeledControls, 45);
  assert.equal(result.unlabeledSamples.length, 16);
});
