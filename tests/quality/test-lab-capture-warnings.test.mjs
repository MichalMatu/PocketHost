import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureWarnings,
  summarizeCaptureWarnings,
} from '../../scripts/test-lab/capture-warnings.mjs';

test('Test Lab reports optional screenshot failures without changing primary failure meaning', () => {
  const captures = [
    {
      route: 'projects',
      error: 'React content not confirmed',
      middleError: 'Middle unavailable',
      createPanelError: 'Node form unavailable',
    },
    { route: 'sites', bottomError: 'Bottom unavailable' },
    { route: 'dashboard' },
    { route: 'projects', createPanelError: '' },
  ];
  assert.deepEqual(captureWarnings(captures[0]), [
    'React content not confirmed',
    'Middle unavailable',
    'Node form unavailable',
  ]);
  assert.deepEqual(summarizeCaptureWarnings(captures), {
    incompleteCaptures: 2,
    captureErrors: 4,
    optionalCaptureErrors: 3,
    createPanelErrors: 1,
  });
  assert.deepEqual(captureWarnings({}), []);
});

test('Test Lab does not count non-error metadata as capture failure', () => {
  const capture = {
    file: 'projects-mobile.png',
    rendered: true,
    middleFile: 'projects-mobile-middle.png',
    bottomFile: 'projects-mobile-bottom.png',
    createPanelFile: 'projects-mobile-create-panel.png',
    jsErrors: 2,
    navigationError: 'unrelated metadata',
  };
  assert.deepEqual(summarizeCaptureWarnings([capture]), {
    incompleteCaptures: 0,
    captureErrors: 0,
    optionalCaptureErrors: 0,
    createPanelErrors: 0,
  });
});

test('missing mobile navigation screenshot is counted but not a primary failure', () => {
  const capture = { mobileMenuError: 'Mobile navigation screenshot unavailable' };
  assert.deepEqual(captureWarnings(capture), [capture.mobileMenuError]);
  assert.deepEqual(summarizeCaptureWarnings([capture]), {
    incompleteCaptures: 1,
    captureErrors: 1,
    optionalCaptureErrors: 1,
    createPanelErrors: 0,
  });
});

test('missing command search screenshot is an optional failure', () => {
  const capture = { commandSearchError: 'Command search screenshot unavailable' };
  assert.deepEqual(captureWarnings(capture), [capture.commandSearchError]);
  assert.equal(summarizeCaptureWarnings([capture]).optionalCaptureErrors, 1);
});
