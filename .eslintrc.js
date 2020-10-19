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
        "files": ["src/**/*.{ts,tsx}"],
        "extends": ["matrix-org/ts"],
        "rules": {
            // We disable this while we're transitioning
            "@typescript-eslint/no-explicit-any": "off",
            // We'd rather not do this but we do
            "@typescript-eslint/ban-ts-comment": "off",

            "quotes": "off",
            "no-extra-boolean-cast": "off",
        },
    }],
};
