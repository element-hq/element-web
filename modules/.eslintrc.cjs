module.exports = {
    plugins: ["matrix-org", "eslint-plugin-react-compiler"],
    extends: ["plugin:matrix-org/typescript", "plugin:matrix-org/react", "plugin:matrix-org/a11y"],
    parserOptions: {
        project: ["./tsconfig.json"],
    },
    env: {
        browser: true,
        node: true,
    },
    rules: {
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
            ...buildRestrictedPropertiesOptions(["window.setImmediate"], "Use setTimeout instead."),
        ],
        "no-restricted-globals": [
            "error",
            {
                name: "setImmediate",
                message: "Use setTimeout instead.",
            },
            {
                name: "Buffer",
                message: "Buffer is not available in the web.",
            },
        ],

        "import/no-duplicates": ["error"],
        "matrix-org/require-copyright-header": "error",

        "react-compiler/react-compiler": "error",
    },
    overrides: [
        {
            files: [
                "packages/element-web-playwright-common/**/*.ts",
                "playwright/**/*.ts",
                "modules/*/element-web/e2e/**/*.{ts,tsx}",
            ],
            rules: {
                // This is necessary for Playwright fixtures
                "no-empty-pattern": "off",
                // This is necessary for Playwright fixtures
                "react-hooks/rules-of-hooks": "off",
                // This just gets annoying in test code
                "@typescript-eslint/explicit-function-return-type": "off",
            },
        },
    ],
    settings: {
        react: {
            version: "detect",
        },
    },
};

function buildRestrictedPropertiesOptions(properties, message) {
    return properties.map((prop) => {
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
