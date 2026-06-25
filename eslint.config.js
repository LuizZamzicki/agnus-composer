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
            "agnus-front/node_modules/**",
            "agnus-front/build/**",
            "agnus-front/coverage/**",
            "agnus-back/node_modules/**",
            "agnus-back/coverage/**",
            "agnus-back/dist/**",
        ],
    },
    js.configs.recommended,
    {
        files: [
            "*.js",
            "agnus-front/*.js",
            "agnus-back/*.js",
            "agnus-back/scripts/**/*.js",
            "agnus-back/src/**/*.js",
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ["agnus-back/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-undef": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    {
        files: ["agnus-front/cypress.config.js", "cypress.config.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ["agnus-back/tests/**/*.{js,ts}"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
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
            parser: tsParser,
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
