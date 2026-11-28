import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePrefix = 'apps/admin/src/';
const primitivePrefix = sourcePrefix + 'components/ui/';
const viewTarget = 300;
const viewCap = 500;
const windowSize = 50;

// Existing template/behavioral exceptions, not blanket file exemptions.
const importantExceptions = new Map([
  ['components/ui/badge.tsx', ['[&>svg]:size-3!']],
  [
    'components/ui/sidebar.tsx',
    [
      'group-data-[collapsible=icon]:size-8!',
      'group-data-[collapsible=icon]:p-2!',
      'group-data-[collapsible=icon]:p-0!',
    ],
  ],
  [
    'components/ui/tooltip.tsx',
    ['inline-end', 'inline-start', 'left', 'right'].map((side) => 'data-[side=' + side + ']:top-1/2!'),
  ],
]);
const inlineLimits = new Map([
  ['components/color-picker.tsx', 1],
  ['components/layouts/base-layout.tsx', 1],
  ['components/theme-customizer/theme-tab.tsx', 1],
  ['components/ui/chart.tsx', 2],
  ['components/ui/sidebar.tsx', 3],
  ['components/ui/toggle-group.tsx', 1],
]);

// Same lexical method as the UX-05/06 inventory. This is a bounded source
// metric, not semantic duplication or a substitute for a visual review.
export function measureDuplication(sources) {
  const firstMatches = new Map();
  const records = [];
  for (const { file, source } of sources) {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      true,
      /\.(?:tsx|jsx)$/.test(file) ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
      source,
    );
    const tokens = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan())
      tokens.push(scanner.getTokenText());
    const index = records.length;
    records.push({ count: tokens.length, diff: new Int32Array(tokens.length + 1) });
    for (let i = 0; i + windowSize <= tokens.length; i++) {
      const key = JSON.stringify(tokens.slice(i, i + windowSize));
      const first = firstMatches.get(key);
      if (!first) {
        firstMatches.set(key, [index, i]);
        continue;
      }
      if (first[0] === index && i - first[1] < windowSize) continue;
      for (const [record, offset] of [first, [index, i]]) {
        records[record].diff[offset]++;
        records[record].diff[offset + windowSize]--;
      }
    }
  }
  let totalTokens = 0;
  let duplicateTokens = 0;
  for (const record of records) {
    let level = 0;
    totalTokens += record.count;
    for (let i = 0; i < record.count; i++) {
      level += record.diff[i];
      if (level > 0) duplicateTokens++;
    }
  }
  return {
    totalTokens,
    duplicateTokens,
    percent: totalTokens ? (100 * duplicateTokens) / totalTokens : 0,
  };
}

export function inspectAdminPresentation(root) {
  const errors = [];
  const aboveTarget = [];
  const sources = [];
  function inspect(file, relative) {
    const source = readFileSync(file, 'utf8');
    if (/\.(?:css|scss|sass|less)$/.test(relative)) {
      if (relative !== sourcePrefix + 'index.css')
        errors.push('Additional admin stylesheet: ' + relative);
      if (/!\s*important\b/i.test(source.replace(/\/\*[\s\S]*?\*\//g, '')))
        errors.push('CSS important override: ' + relative);
      return;
    }
    if (!/\.(?:tsx?|jsx?)$/.test(relative)) return;
    const local = relative.slice(sourcePrefix.length);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const allowed = new Set(importantExceptions.get(local) ?? []);
    let inline = 0;
    function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'style') inline++;
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        for (const token of node.text.split(/\s+/)) {
          if (/(?:^|:)![-\w][\w[\]/.%()-]*$/.test(token) || /[-\w\])%]!$/.test(token)) {
            if (!allowed.delete(token))
              errors.push('Tailwind important override: ' + relative + ' ' + token);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (inline > (inlineLimits.get(local) ?? 0))
      errors.push('Unreviewed JSX inline style: ' + relative);
    if (local.startsWith('app/') && /\.(?:tsx|jsx)$/.test(local)) {
      const lines = source.split('\n').length;
      if (lines > viewCap) errors.push('Admin view line budget: ' + relative + ' (max 500)');
      if (lines > viewTarget) aboveTarget.push({ file: relative, lines });
    }
    if (
      local.startsWith('app/') ||
      (local.startsWith('components/') && !relative.startsWith(primitivePrefix))
    )
      sources.push({ file: relative, source });
  }
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) continue; // Existing source boundary rejects symlinks.
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) inspect(file, relative);
    }
  }
  try {
    walk(path.join(root, sourcePrefix));
  } catch (error) {
    if (error.code !== 'ENOENT' || error.path !== path.join(root, sourcePrefix)) throw error;
  }
  sources.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const duplication = measureDuplication(sources);
  if (duplication.percent >= 3)
    errors.push('Admin source duplication: ' + duplication.percent.toFixed(2) + '% (target < 3%)');
  return { errors, aboveTarget, duplication };
}
