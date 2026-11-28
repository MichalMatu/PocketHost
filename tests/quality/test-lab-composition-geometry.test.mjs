import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCompositionGeometry } from '../../scripts/test-lab/composition-geometry.mjs';

const style = {
  fontSize: '14px',
  fontWeight: '500',
  lineHeight: '20px',
  paddingTop: '0px',
  paddingRight: '10px',
  paddingBottom: '0px',
  paddingLeft: '10px',
  rowGap: '6px',
  columnGap: '6px',
  backgroundColor: 'rgb(0, 0, 0)',
  color: 'rgb(255, 255, 255)',
  borderTopWidth: '1px',
  borderTopColor: 'rgb(50, 50, 50)',
  borderTopLeftRadius: '8px',
  boxShadow: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  visibility: 'visible',
};

function node({ left = 50, top = 80, width = 100, height = 32, text = 'private label' } = {}) {
  return {
    textContent: text,
    getBoundingClientRect: () => ({ left, top, width, height }),
    querySelector: () => null,
  };
}

test('composition vectors exclude hidden headings, use shell-relative positions and omit text', () => {
  const title = node();
  const hidden = node({ width: 1, height: 1 });
  const refresh = node({ text: 'Refresh' });
  const other = node({ text: 'private project name' });
  const headerButton = node();
  const root = {
    getBoundingClientRect: () => ({ left: 24, top: 8, width: 400 }),
    querySelector: () => ({ contains: (item) => item === headerButton }),
    querySelectorAll: (selector) => {
      if (selector === 'h1' || selector.startsWith('h1,')) return [hidden, title];
      if (selector.startsWith('button,')) return [refresh, other, headerButton];
      return [];
    },
  };
  const result = inspectCompositionGeometry({
    doc: { querySelector: () => root },
    win: { innerWidth: 424, innerHeight: 900, getComputedStyle: () => style },
  });
  assert.equal(result.hiddenH1, 1);
  assert.deepEqual(result.roles.titles.samples[0].box, [26, 72, 100, 32]);
  assert.equal(result.roles.buttons.count, 2);
  assert.equal(result.roles.buttons.signatures, 1);
  assert.equal(result.roles.refresh.count, 1);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('Refresh'), false);
});

test('missing shell is explicitly unavailable', () => {
  assert.equal(inspectCompositionGeometry({ doc: { querySelector: () => null } }), null);
});
