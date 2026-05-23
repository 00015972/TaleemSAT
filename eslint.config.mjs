import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/migrations/**',
      'build/**',
      'out/**',
      'next-env.d.ts',
      '.agents/**',
      'design/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
