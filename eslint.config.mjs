import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      // BGV design system: generated/vendored copies of design/system (scripts/bgv-sync.mjs).
      'packages/ui/src/bgv/bgv.js', 'packages/ui/src/bgv/bgv.d.ts', 'packages/ui/src/bgv/reference/**', 'design/**', 'BGV-DesignSystem-Handoff/**', 'scripts/ds-check.mjs', 'scripts/ds-qa-report.mjs',
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'test-results/**',
      'playwright-report/**',
      'packages/db/migrations/**',
      '.claude/**',
      'tools/**',
      'prompts/**',
      '.dragon-backups/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}', 'games/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
);
