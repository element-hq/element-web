/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

module.exports = {
    root: true,
    plugins: ["matrix-org", "eslint-plugin-react-compiler"],
    extends: [
        "plugin:matrix-org/babel",
        "plugin:matrix-org/react",
        "plugin:matrix-org/a11y",
        "plugin:storybook/recommended",
    ],
    parserOptions: {
        project: ["./tsconfig.json"],
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
    },
    overrides: [
        {
            files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
            extends: ["plugin:matrix-org/typescript", "plugin:matrix-org/react"],
            rules: {
                "@typescript-eslint/explicit-function-return-type": [
                    "error",
                    {
                        allowExpressions: true,
                    },
                ],

                // Remove Babel things manually due to override limitations
                "@babel/no-invalid-this": ["off"],

                // We're okay being explicit at the moment
                "@typescript-eslint/no-empty-interface": "off",
                // We disable this while we're transitioning
                "@typescript-eslint/no-explicit-any": "off",
                // We'd rather not do this but we do
                "@typescript-eslint/ban-ts-comment": "off",
                // We're okay with assertion errors when we ask for them
                "@typescript-eslint/no-non-null-assertion": "off",
                "@typescript-eslint/no-empty-object-type": [
                    "error",
                    {
                        // We do this sometimes to brand interfaces
                        allowInterfaces: "with-single-extends",
                    },
                ],
            },
        },
    ],
    settings: {
        react: {
            version: "detect",
        },
    },
};
