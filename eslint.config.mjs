import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * eslint-config-next 16 ships native flat configs, so these are spread directly.
 * (Earlier versions needed @eslint/eslintrc FlatCompat; that path now throws.)
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Architectural boundary (docs/ARCHITECTURE.md §2): the domain layer holds business
    // logic and must stay testable without React, Next, or a running server.
    // Dependencies flow app -> components -> domain, never back.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/domain must not depend on React.' },
            { name: 'react-dom', message: 'src/domain must not depend on React.' },
          ],
          patterns: [
            {
              group: ['next', 'next/*', '@/components/*', '@/app/*'],
              message:
                'src/domain must not import Next.js, components, or app routes. Dependencies flow inward only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'no-console': 'off',
      // Playwright fixtures take a callback named `use`, which the React Hooks rule
      // mistakes for a hook.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    ignores: [
      '.next/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'src/app/(payload)/admin/importMap.js',
      'src/migrations/',
    ],
  },
]

export default eslintConfig
