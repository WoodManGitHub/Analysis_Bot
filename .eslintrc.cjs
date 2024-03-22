module.exports = {
    'root': true,
    'env': {
        'es2021': true,
        'node': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'ecmaVersion': 12,
        'sourceType': 'module'
    },
    'plugins': [
        '@typescript-eslint'
    ],
    'rules': {
        'indent': [
            'error',
            4,
            {
                'SwitchCase': 1
            }
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ],
        'eqeqeq': 'error',
        'no-unused-vars': 'warn',
        'no-trailing-spaces': 'error',
        'camelcase': 'warn',
        'no-var': 'error',
        'no-useless-return': 'error',
        'no-else-return': 'error',
        'no-empty': 'error',
        'space-before-function-paren': [
            'error',
            'never'
        ],
        'space-in-parens': 'error',
        'space-before-blocks': 'error',
        'comma-dangle': 'error',
        'no-duplicate-imports': 'error'
    }
};