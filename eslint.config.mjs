import path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import css from '@eslint/css';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import html from '@html-eslint/eslint-plugin';
import { configs, helpers, plugins } from 'eslint-config-airbnb-extended';
import pluginPromise from 'eslint-plugin-promise';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

const gitignorePath = path.resolve('.', '.gitignore');

const jsConfig = defineConfig([
  // ESLint recommended config
  {
    name: 'js/config',
    files: helpers.extensions.allFiles,
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 'latest',
      },
      globals: { // Set per project
        ...globals.builtin,
        ...globals.browser,
        gradioApp: 'readonly',
        log: 'readonly',
        error: 'readonly',
        logFn: 'readonly',
        generateForever: 'readonly',
        onUiReady: 'readonly',
        appUiUx: 'readonly',
        getStored: 'readonly',
        setStored: 'readonly',
        htmlPath: 'readonly',
        initSplitComponents: 'readonly',
        initAccordionComponents: 'readonly',
        initTabComponents: 'readonly',
        initButtonComponents: 'readonly',
        setupToolButtons: 'readonly',
        setupDropdowns: 'readonly',
        setupGenerateObservers: 'readonly',
        setupDynamicObservers: 'readonly',
        setupControlDynamicObservers: 'readonly',
        setUserColors: 'readonly',
        showContributors: 'readonly',
        createButtonsForExtensions: 'readonly',
      },
    },
  },
  pluginPromise.configs['flat/recommended'],
  // Stylistic plugin
  plugins.stylistic,
  // Import X plugin
  plugins.importX,
  // Airbnb base recommended config
  ...configs.base.recommended,
  {
    files: helpers.extensions.allFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
    rules: {
      camelcase: 'off',
      'default-case': 'off',
      'max-classes-per-file': 'warn',
      'no-await-in-loop': 'off',
      'no-bitwise': 'off',
      'no-continue': 'off',
      'no-console': 'off',
      'no-loop-func': 'off',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-redeclare': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-unused-vars': 'off',
      'no-use-before-define': 'warn',
      'no-useless-escape': 'off',
      'prefer-destructuring': 'off',
      'prefer-rest-params': 'off',
      'prefer-template': 'warn',
      radix: 'off',
      '@stylistic/brace-style': [
        'error',
        '1tbs',
        {
          allowSingleLine: true,
        },
      ],
      '@stylistic/indent': ['error', 2],
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        {
          exceptAfterSingleLine: true,
        },
      ],
      '@stylistic/max-len': [
        'warn',
        {
          code: 275,
          tabWidth: 2,
        },
      ],
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/no-mixed-operators': 'off',
      '@stylistic/object-curly-newline': [
        'error',
        {
          multiline: true,
          consistent: true,
        },
      ],
      '@stylistic/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      '@stylistic/semi': [
        'error',
        'always',
        {
          omitLastInOneLineBlock: false,
        },
      ],
      'promise/always-return': 'off',
      'promise/catch-or-return': 'off',
    },
  },
]);

// const typescriptConfig = defineConfig([
//   // TypeScript ESLint plugin
//   plugins.typescriptEslint,
//   // Airbnb base TypeScript config
//   ...configs.base.typescript,
//   {
//     name: 'sdnext/typescript',
//     files: helpers.extensions.tsFiles,
//     rules: {
//       '@typescript-eslint/ban-ts-comment': 'off',
//       '@typescript-eslint/explicit-module-boundary-types': 'off',
//       '@typescript-eslint/no-shadow': 'error',
//       '@typescript-eslint/no-var-requires': 'off',
//     },
//   },
// ]);

// const nodeConfig = defineConfig([
//   // Node plugin
//   plugins.node,
//   // Airbnb Node recommended config
//   ...configs.node.recommended,
// ]);

const jsonConfig = defineConfig([
  {
    files: ['**/*.json'],
    ignores: ['package-lock.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
]);

const markdownConfig = defineConfig([
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    processor: 'markdown/markdown',
    extends: ['markdown/recommended'],
  },
]);

const cssConfig = defineConfig([
  {
    files: ['**/*.css'],
    language: 'css/css',
    plugins: { css },
    extends: ['css/recommended'],
    // languageOptions: {
    //   tolerant: true,
    // },
    rules: {
      'css/font-family-fallbacks': 'off',
      'css/no-invalid-properties': [
        'error',
        {
          allowUnknownVariables: true,
        },
      ],
      'css/no-important': 'off',
      'css/use-baseline': 'off',
    },
  },
]);

const htmlConfig = defineConfig([
  {
    files: ['**/*.html'],
    plugins: {
      html,
    },
    extends: ['html/recommended'],
    language: 'html/html',
    rules: {
      'html/attrs-newline': 'off',
      'html/element-newline': 'off',
      'html/indent': [
        'warn',
        2,
      ],
      'html/no-duplicate-class': 'error',
      'html/no-extra-spacing-attrs': [
        'error',
        {
          enforceBeforeSelfClose: true,
          disallowMissing: true,
          disallowTabs: true,
          disallowInAssignment: true,
        },
      ],
      'html/require-closing-tags': [
        'error',
        {
          selfClosing: 'always',
        },
      ],
      'html/use-baseline': 'off',
    },
  },
]);

export default defineConfig([
  // Ignore files and folders listed in .gitignore
  includeIgnoreFile(gitignorePath),
  globalIgnores([
    '**/node_modules',
    '**/extensions',
    '**/repositories',
    '**/venv',
    '**/panZoom.js',
    '**/split.js',
    '**/exifr.js',
    '**/iframeResizer.min.js',
  ]),
  ...jsConfig,
  // ...typescriptConfig,
  // ...nodeConfig,
  ...jsonConfig,
  ...markdownConfig,
  ...cssConfig,
  ...htmlConfig,
]);
