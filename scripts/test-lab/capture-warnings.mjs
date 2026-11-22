/** Fixed capture-stage warnings: no page text, API body or browser logs. */
const ERROR_FIELDS = ['error', 'middleError', 'bottomError', 'createPanelError'];
const OPTIONAL_ERROR_FIELDS = ['middleError', 'bottomError', 'createPanelError'];

export function captureWarnings(capture) {
  return ERROR_FIELDS.filter(
    (field) => typeof capture?.[field] === 'string' && capture[field],
  ).map((field) => capture[field]);
}

export function summarizeCaptureWarnings(captures) {
  let incompleteCaptures = 0;
  let captureErrors = 0;
  let optionalCaptureErrors = 0;
  let createPanelErrors = 0;
  for (const capture of captures) {
    const warnings = captureWarnings(capture);
    if (warnings.length) incompleteCaptures++;
    captureErrors += warnings.length;
    optionalCaptureErrors += OPTIONAL_ERROR_FIELDS.filter((field) =>
      Boolean(capture?.[field]),
    ).length;
    if (capture?.createPanelError) createPanelErrors++;
  }
  return { incompleteCaptures, captureErrors, optionalCaptureErrors, createPanelErrors };
}
