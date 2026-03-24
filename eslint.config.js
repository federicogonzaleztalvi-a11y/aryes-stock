import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // ── Ignore generated / vendor files ──────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // ── Base JS rules ─────────────────────────────────────────────────────────
  js.configs.recommended,

  // ── React + Hooks rules ───────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      // ── React ──────────────────────────────────────────────────────────
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off',     // not needed with Vite/React 18
      'react/prop-types': 'off',             // no TypeScript — skip prop-types
      'react/display-name': 'off',

      // ── React Hooks (the high-value rules) ────────────────────────────
      'react-hooks/rules-of-hooks': 'error',  // hooks called at top level only
      'react-hooks/exhaustive-deps': 'warn',  // missing deps in useEffect

      // ── React Refresh (dev) ────────────────────────────────────────────
      'react-refresh/only-export-components': 'warn',

      // ── JS quality ────────────────────────────────────────────────────
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',       // allow _unused convention
        argsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'warn',

      // ── Rules we explicitly allow (code style, not correctness) ───────
      'no-empty': 'warn',
      'no-fallthrough': 'warn',
    },
  },

  // ── API serverless files (Node env, no JSX) ───────────────────────────────
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    },
  },
];
