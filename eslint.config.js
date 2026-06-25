const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const globals = require("globals");

const browserGlobals = {
    ...globals.browser,
    ...globals.es2021,
};

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "agnus-back/**",
            "agnus-front/node_modules/**",
            "agnus-front/build/**",
            "agnus-front/coverage/**",
        ],
    },
    js.configs.recommended,
    {
        files: ["*.js", "*.cjs", "*.mjs", "**/.eslintrc.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.node,
        },
    },
    {
        files: ["agnus-front/src/**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...browserGlobals,
                process: "readonly",
            },
        },
    },
    {
        files: ["agnus-front/src/**/*.{ts,tsx}"],
        rules: {
            "no-undef": "off",
        },
    },
    {
        files: [
            "agnus-front/src/**/*.test.{js,jsx,ts,tsx}",
            "agnus-front/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
        ],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    {
        files: ["agnus-front/cypress/**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...browserGlobals,
                ...globals.node,
                ...globals.mocha,
                cy: "readonly",
                Cypress: "readonly",
                expect: "readonly",
            },
        },
    },
];
