const path = require('path');

// get the path of the js-sdk so we can extend the config
// eslint supports loading extended configs by module,
// but only if they come from a module that starts with eslint-config-
// So we load the filename directly (and it could be in node_modules/
// or or ../node_modules/ etc)
//
// We add a `..` to the end because the js-sdk lives out of lib/, but the eslint
// config is at the project root.
const matrixJsSdkPath = path.join(path.dirname(require.resolve('matrix-js-sdk')), '..');

module.exports = {
    extends: ["matrix-org", "matrix-org/react-legacy"],
    parser: "babel-eslint",

    env: {
        browser: true,
        node: true,
    },
    globals: {
        LANGUAGES_FILE: "readonly",
    },
    rules: {
        // Things we do that break the ideal style
        "no-constant-condition": "off",
        "prefer-promise-reject-errors": "off",
        "no-async-promise-executor": "off",
        "quotes": "off",
        "indent": "off",
    },

    overrides: [{
        files: ["src/**/*.{ts, tsx}"],
        "extends": ["matrix-org/ts"],
        "rules": {
            // We disable this while we're transitioning
            "@typescript-eslint/no-explicit-any": "off",
            // We'd rather not do this but we do
            "@typescript-eslint/ban-ts-comment": "off",

            "quotes": "off",
            "no-extra-boolean-cast": "off",
        }
    }],
};
