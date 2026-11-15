/**
 * PocketHost A8 dependency manifest. Lockfiles remain the source of exact
 * versions and npm integrity hashes; no package install happens by importing
 * this file. Companion / Shizuku / Termux:API are optional capability sources.
 *
 * Required Termux packages (system scope, install manually only if missing):
 *   nodejs, git, curl, python, termux-services (sv/runit)
 * Required project dependencies: npm ci against both committed lockfiles
 *   (root + apps/admin), only in a verified isolated QA checkout.
 * No global npm install, no package postinstall scripts, no unknown binaries.
 */
export const TERMUX_DEPENDENCY_MANIFEST = Object.freeze({
  version: 1,
  requiredTermuxPackages: ['nodejs', 'git', 'curl', 'python', 'termux-services'],
  requiredProjectLockfiles: ['package-lock.json', 'apps/admin/package-lock.json'],
  optionalCapabilities: ['termux-api', 'PocketHost Companion', 'Shizuku'],
  qaTools: {
    rootTypecheck: 'node_modules/typescript/bin/tsc',
    adminTypecheck: 'apps/admin/node_modules/typescript/bin/tsc',
    rootLint: 'node_modules/eslint/bin/eslint.js',
    rootFormat: 'node_modules/prettier/bin/prettier.cjs',
    rootMarkdown: 'node_modules/markdownlint-cli2/markdownlint-cli2.mjs',
    adminUI: 'apps/admin/node_modules/vitest/vitest.mjs',
  },
});
