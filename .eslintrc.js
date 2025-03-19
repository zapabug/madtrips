module.exports = {
  rules: {
    // For React Hook dependency warnings
    'react-hooks/exhaustive-deps': 'warn',
    
    // For string escaping
    'react/no-unescaped-entities': 'warn',
    
    // If you want to temporarily disable the any type errors while fixing them
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // For unused vars, allow _ prefix for intentionally unused
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }]
  }
};