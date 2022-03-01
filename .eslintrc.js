module.exports = {
    plugins: ["matrix-org"],
    extends: [
        "plugin:matrix-org/babel",
        "plugin:matrix-org/react",
    ],
    env: {
        browser: true,
        node: true,
    },
    rules: {
        // Things we do that break the ideal style
        "quotes": "off",
    },
    overrides: [{
        files: ["src/**/*.{ts,tsx}"],
        extends: [
            "plugin:matrix-org/typescript",
            "plugin:matrix-org/react",
        ],
        rules: {
            // Things we do that break the ideal style
            "prefer-promise-reject-errors": "off",
            "quotes": "off",

            // We disable this while we're transitioning
            "@typescript-eslint/no-explicit-any": "off",

            // Ban matrix-js-sdk/src imports in favour of matrix-js-sdk/src/matrix imports to prevent unleashing hell.
            "no-restricted-imports": ["error", {
                "name": "matrix-js-sdk",
                "message": "Please use matrix-js-sdk/src/matrix instead",
            }, {
                "name": "matrix-js-sdk/",
                "message": "Please use matrix-js-sdk/src/matrix instead",
            }, {
                "name": "matrix-js-sdk/src",
                "message": "Please use matrix-js-sdk/src/matrix instead",
            }, {
                "name": "matrix-js-sdk/src/",
                "message": "Please use matrix-js-sdk/src/matrix instead",
            }, {
                "name": "matrix-js-sdk/src/index",
                "message": "Please use matrix-js-sdk/src/matrix instead",
            }],
        },
    }],
};
