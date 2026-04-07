/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

module.exports = {
    root: true,
    plugins: ["matrix-org", "eslint-plugin-react-compiler"],
    extends: [
        "plugin:matrix-org/react",
        "plugin:matrix-org/a11y",
        "plugin:matrix-org/typescript",
        "plugin:matrix-org/react",
        "plugin:storybook/recommended",
    ],
    parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
    },
    env: {
        browser: true,
        node: true,
    },
    rules: {
        // Bind or arrow functions in props causes performance issues (but we
        // currently use them in some places).
        // It's disabled here, but we should using it sparingly.
        "react/jsx-no-bind": "off",
        "react/jsx-key": ["error"],
        "matrix-org/require-copyright-header": "error",
        "react-compiler/react-compiler": "error",
        "no-restricted-imports": [
            "error",
            {
                paths: [
                    {
                        name: "react",
                        importNames: ["act"],
                        message: "Please use @test-utils instead.",
                    },
                ],
            },
        ],

        "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
        "@typescript-eslint/explicit-function-return-type": [
            "error",
            {
                allowExpressions: true,
            },
        ],

        // We're okay being explicit at the moment
        // "@typescript-eslint/no-empty-interface": "off",
        // We'd rather not do this but we do
        // "@typescript-eslint/ban-ts-comment": "off",
        // We're okay with assertion errors when we ask for them
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-empty-object-type": [
            "error",
            {
                // We do this sometimes to brand interfaces
                allowInterfaces: "with-single-extends",
            },
        ],
        "storybook/meta-satisfies-type": "error",

        "react/forbid-elements": [
            "error",
            {
                forbid: [
                    { element: "h1", message: "Use Compound <Heading> instead" },
                    { element: "h2", message: "Use Compound <Heading> instead" },
                    { element: "h3", message: "Use Compound <Heading> instead" },
                    { element: "h4", message: "Use Compound <Heading> instead" },
                    { element: "h5", message: "Use Compound <Heading> instead" },
                    { element: "h6", message: "Use Compound <Heading> instead" },
                ],
            },
        ],
    },
    overrides: [
        {
            files: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.tsx"],
            rules: {
                "@typescript-eslint/unbound-method": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "react/forbid-elements": "off",
            },
        },
    ],
    settings: {
        react: {
            version: "detect",
        },
    },
};
