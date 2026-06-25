module.exports = {
    env: {
        browser: true,
        node: true,
        es2021: true
    },

    extends: [
        "react-app"
    ],

    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
    },

    rules: {
        "no-undef": "off"
    }
};