import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/', '**/node_modules/', '_archive/', '**/*.js', '!eslint.config.js'] },

  // Base config for all TS files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server-specific rules
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { project: './server/tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',  // Start as warning, upgrade to error later
      '@typescript-eslint/explicit-function-return-type': 'off',  // Too noisy initially
      'no-console': 'warn',  // Will be upgraded to error after REFACTOR-008 (structured logger)
    },
  },

  // Client-specific rules
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { project: './client/tsconfig.app.json' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier must be LAST to override formatting rules
  prettierConfig,
);
