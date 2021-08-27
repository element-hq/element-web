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
    globals: {
        LANGUAGES_FILE: "readonly",
    },
    rules: {
        // Things we do that break the ideal style
        "no-constant-condition": "off",
        "prefer-promise-reject-errors": "off",
        "no-async-promise-executor": "off",
        "quotes": "off",
        "no-extra-boolean-cast": "off",

        // Bind or arrow functions in props causes performance issues (but we
        // currently use them in some places).
        // It's disabled here, but we should using it sparingly.
        "react/jsx-no-bind": "off",
        "react/jsx-key": ["error"],

        "no-restricted-properties": [
            "error",
            ...buildRestrictedPropertiesOptions(
                ["window.innerHeight", "window.innerWidth", "window.visualViewport"],
                "Use UIStore to access window dimensions instead.",
            ),
            ...buildRestrictedPropertiesOptions(
                ["*.mxcUrlToHttp", "*.getHttpUriForMxc"],
                "Use Media helper instead to centralise access for customisation.",
            ),
        ],
    },
    overrides: [{
        files: [
            "src/**/*.{ts,tsx}",
            "test/**/*.{ts,tsx}",
        ],
        extends: [
            "plugin:matrix-org/typescript",
            "plugin:matrix-org/react",
        ],
        rules: {
            // Things we do that break the ideal style
            "prefer-promise-reject-errors": "off",
            "quotes": "off",
            "no-extra-boolean-cast": "off",

            // Remove Babel things manually due to override limitations
            "@babel/no-invalid-this": ["off"],

            // We're okay being explicit at the moment
            "@typescript-eslint/no-empty-interface": "off",
            // We disable this while we're transitioning
            "@typescript-eslint/no-explicit-any": "off",
            // We'd rather not do this but we do
            "@typescript-eslint/ban-ts-comment": "off",
        },
    }],
    settings: {
        react: {
            version: "detect",
        }
    }
};

function buildRestrictedPropertiesOptions(properties, message) {
    return properties.map(prop => {
        let [object, property] = prop.split(".");
        if (object === "*") {
            object = undefined;
        }
        return {
            object,
            property,
            message,
        };
    });
}
