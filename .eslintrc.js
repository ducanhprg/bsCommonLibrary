module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    // Code quality rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    
    // Style rules
    'max-len': ['error', { code: 120 }],
    'max-lines-per-function': ['error', { max: 20 }], // Your 20-line rule
    'complexity': ['error', 10],
    
    // Import rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-lines-per-function': 'off', // Allow longer test functions
        'no-console': 'off',
      },
    },
  ],
}; 