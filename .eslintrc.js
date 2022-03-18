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
    settings: {
        react: {
            version: 'detect'
        }
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
                "paths": [{
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
                }, {
                    "name": "matrix-react-sdk",
                    "message": "Please use matrix-react-sdk/src/index instead",
                }, {
                    "name": "matrix-react-sdk/",
                    "message": "Please use matrix-react-sdk/src/index instead",
                }],
                "patterns": [{
                    "group": ["matrix-js-sdk/lib", "matrix-js-sdk/lib/", "matrix-js-sdk/lib/**"],
                    "message": "Please use matrix-js-sdk/src/* instead",
                }, {
                    "group": ["matrix-react-sdk/lib", "matrix-react-sdk/lib/", "matrix-react-sdk/lib/**"],
                    "message": "Please use matrix-react-sdk/src/* instead",
                }],
            }],
        },
    }],
};
