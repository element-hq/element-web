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
    },

    overrides: [{
        "files": ["src/**/*.{ts,tsx}"],
        "extends": ["matrix-org/ts"],
        "rules": {
            // We're okay being explicit at the moment
            "@typescript-eslint/no-empty-interface": "off",
            // We disable this while we're transitioning
            "@typescript-eslint/no-explicit-any": "off",
            // We'd rather not do this but we do
            "@typescript-eslint/ban-ts-comment": "off",

            "quotes": "off",
            "no-extra-boolean-cast": "off",
            "no-restricted-properties": [
                "error",
                ...buildRestrictedPropertiesOptions(
                    ["window.innerHeight", "window.innerWidth", "window.visualViewport"],
                    "Use UIStore to access window dimensions instead",
                ),
            ],
        },
    }],
};

function buildRestrictedPropertiesOptions(properties, message) {
    return properties.map(prop => {
        const [object, property] = prop.split(".");
        return {
            object,
            property,
            message,
        };
    });
}
