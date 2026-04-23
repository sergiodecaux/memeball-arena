module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Запрет console.* (кроме warn и error в крайних случаях)
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    
    // Предупреждение о неиспользуемых переменных
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // Требовать явные типы возврата для публичных методов
    '@typescript-eslint/explicit-function-return-type': 'off',
    
    // Разрешить any (временно, для миграции)
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Проверка на забытые await
    'require-await': 'warn',
    
    // Запрет на пустые функции (кроме catch)
    '@typescript-eslint/no-empty-function': ['warn', {
      allow: ['arrowFunctions', 'functions', 'methods']
    }],
    
    // Предупреждение о магических числах (игнорируем -1, 0, 1)
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true
    }]
  },
  overrides: [
    {
      // Для файлов в папке utils разрешаем console для логгеров
      files: ['src/utils/ProductionLogger.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
