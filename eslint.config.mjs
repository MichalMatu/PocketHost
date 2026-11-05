import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'apps/admin/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{mjs,js}'], languageOptions: { globals: globals.node } },
  prettier,
);
