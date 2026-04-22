/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

module.exports = {
    plugins: ["matrix-org", "eslint-plugin-react-compiler"],
    extends: ["plugin:matrix-org/babel", "plugin:matrix-org/react", "plugin:matrix-org/a11y"],
    parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
    },
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
                ["React.forwardRef", "*.forwardRef", "forwardRef"],
                "Use ref props instead.",
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
        "no-restricted-imports": [
            "error",
            {
                paths: [
                    {
                        name: "react",
                        importNames: ["forwardRef"],
                        message: "Use ref props instead.",
                    },
                    {
                        name: "@testing-library/react",
                        message: "Please use jest-matrix-react instead",
                    },
                    {
                        name: "matrix-js-sdk/",
                        message: "Please use matrix-js-sdk instead",
                    },
                    {
                        name: "matrix-js-sdk/src",
                        message: "Please use 'matrix-js-sdk' instead",
                    },
                    {
                        name: "matrix-js-sdk/src/",
                        message: "Please use 'matrix-js-sdk' instead",
                    },
                    {
                        name: "matrix-js-sdk/lib/",
                        message: "Please use 'matrix-js-sdk' instead",
                    },
                    {
                        name: "emojibase-regex",
                        message:
                            "This regex doesn't actually test for emoji. See the docs at https://emojibase.dev/docs/regex/ and prefer our own EMOJI_REGEX from HtmlUtils.",
                    },
                ],
                patterns: [
                    // Ban matrix-js-sdk/src imports in favour of compiled matrix-js-sdk imports to prevent unleashing hell.
                    {
                        group: [
                            "matrix-js-sdk/src/**",
                            "matrix-js-sdk/lib/**",
                            "!matrix-js-sdk/lib/crypto-api",
                            "!matrix-js-sdk/lib/crypto-api/index.js",
                            "!matrix-js-sdk/lib/types.js",
                            "!matrix-js-sdk/lib/testing.js",
                            "!matrix-js-sdk/lib/utils",
                            "!matrix-js-sdk/lib/utils/*.js",
                            // XXX: Temporarily allow these as they are not available via the main export
                            "!matrix-js-sdk/lib/logger.js",
                            "!matrix-js-sdk/lib/errors.js",
                            "!matrix-js-sdk/lib/utils.js",
                            "!matrix-js-sdk/lib/version-support.js",
                            "!matrix-js-sdk/lib/randomstring.js",
                            "!matrix-js-sdk/lib/sliding-sync.js",
                            "!matrix-js-sdk/lib/feature.js",
                            "!matrix-js-sdk/lib/NamespacedValue.js",
                            "!matrix-js-sdk/lib/ReEmitter.js",
                            "!matrix-js-sdk/lib/event-mapper.js",
                            "!matrix-js-sdk/lib/interactive-auth.js",
                            "!matrix-js-sdk/lib/secret-storage.js",
                            "!matrix-js-sdk/lib/room-hierarchy.js",
                            "!matrix-js-sdk/lib/rendezvous",
                            "!matrix-js-sdk/lib/rendezvous/index.js",
                            "!matrix-js-sdk/lib/indexeddb-worker.js",
                            "!matrix-js-sdk/lib/pushprocessor.js",
                            "!matrix-js-sdk/lib/extensible_events_v1",
                            "!matrix-js-sdk/lib/extensible_events_v1/PollStartEvent.js",
                            "!matrix-js-sdk/lib/extensible_events_v1/PollResponseEvent.js",
                            "!matrix-js-sdk/lib/extensible_events_v1/PollEndEvent.js",
                            "!matrix-js-sdk/lib/extensible_events_v1/InvalidEventError.js",
                            "!matrix-js-sdk/lib/oidc",
                            "!matrix-js-sdk/lib/oidc/discovery.js",
                            "!matrix-js-sdk/lib/oidc/authorize.js",
                            "!matrix-js-sdk/lib/oidc/validate.js",
                            "!matrix-js-sdk/lib/oidc/error.js",
                            "!matrix-js-sdk/lib/oidc/register.js",
                            "!matrix-js-sdk/lib/webrtc",
                            "!matrix-js-sdk/lib/webrtc/call.js",
                            "!matrix-js-sdk/lib/webrtc/callFeed.js",
                            "!matrix-js-sdk/lib/webrtc/mediaHandler.js",
                            "!matrix-js-sdk/lib/webrtc/callEventTypes.js",
                            "!matrix-js-sdk/lib/webrtc/callEventHandler.js",
                            "!matrix-js-sdk/lib/webrtc/groupCallEventHandler.js",
                            "!matrix-js-sdk/lib/models",
                            "!matrix-js-sdk/lib/models/read-receipt.js",
                            "!matrix-js-sdk/lib/models/relations-container.js",
                            "!matrix-js-sdk/lib/models/related-relations.js",
                            "!matrix-js-sdk/lib/matrixrtc",
                            "!matrix-js-sdk/lib/matrixrtc/index.js",
                        ],
                        message: "Please use 'matrix-js-sdk' instead",
                    },
                    {
                        group: ["emojibase-regex/emoji*"],
                        message:
                            "This regex doesn't actually test for emoji. See the docs at https://emojibase.dev/docs/regex/ and prefer our own EMOJI_REGEX from HtmlUtils.",
                    },
                    // Ban compound-design-tokens raw svg imports in favour of their React component counterparts
                    {
                        group: ["@vector-im/compound-design-tokens/icons/*"],
                        message: "Please use @vector-im/compound-design-tokens/assets/web/icons/* instead",
                    },
                    {
                        group: ["**/packages/shared-components/**", "../packages/shared-components/**"],
                        message: "Please use @element-hq/web-shared-components",
                    },
                ],
            },
        ],

        // There are too many a11y violations to fix at once
        // Turn violated rules off until they are fixed
        "jsx-a11y/aria-activedescendant-has-tabindex": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/interactive-supports-focus": "off",
        "jsx-a11y/media-has-caption": "off",
        "jsx-a11y/mouse-events-have-key-events": "off",
        "jsx-a11y/no-autofocus": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "jsx-a11y/no-static-element-interactions": "off",
        "jsx-a11y/role-supports-aria-props": "off",

        "matrix-org/require-copyright-header": "error",

        "react-compiler/react-compiler": "error",
    },
    overrides: [
        {
            files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}", "playwright/**/*.ts", "*.ts"],
            extends: ["plugin:matrix-org/typescript", "plugin:matrix-org/react"],
            rules: {
                "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
                "@typescript-eslint/explicit-function-return-type": [
                    "error",
                    {
                        allowExpressions: true,
                    },
                ],

                // Things we do that break the ideal style
                "prefer-promise-reject-errors": "off",
                "no-extra-boolean-cast": "off",

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
        {
            files: ["test/**/*.{ts,tsx}", "playwright/**/*.ts"],
            extends: ["plugin:matrix-org/jest"],
            rules: {
                // We don't need super strict typing in test utilities
                "@typescript-eslint/explicit-function-return-type": "off",
                "@typescript-eslint/explicit-member-accessibility": "off",
                "@typescript-eslint/no-empty-object-type": "off",
                "@typescript-eslint/unbound-method": "off",

                // Jest/Playwright specific

                // Disabled tests are a reality for now but as soon as all of the xits are
                // eliminated, we should enforce this.
                "jest/no-disabled-tests": "off",
                // Also treat "oldBackendOnly" as a test function.
                // Used in some crypto tests.
                "jest/no-standalone-expect": [
                    "error",
                    {
                        additionalTestBlockFunctions: ["beforeAll", "beforeEach", "oldBackendOnly"],
                    },
                ],

                // These are fine in tests
                "no-restricted-globals": "off",
                "react-compiler/react-compiler": "off",
            },
        },
        {
            files: ["playwright/**/*.ts"],
            parserOptions: {
                project: ["./playwright/tsconfig.json"],
            },
            rules: {
                "react-hooks/rules-of-hooks": ["off"],
                "@typescript-eslint/no-floating-promises": ["error"],
            },
        },
        {
            files: ["module_system/**/*.{ts,tsx}"],
            parserOptions: {
                project: ["./tsconfig.module_system.json"],
            },
            extends: ["plugin:matrix-org/typescript", "plugin:matrix-org/react"],
            // NOTE: These rules are frozen and new rules should not be added here.
            // New changes belong in https://github.com/matrix-org/eslint-plugin-matrix-org/
            rules: {
                // Things we do that break the ideal style
                "prefer-promise-reject-errors": "off",
                "quotes": "off",

                // We disable this while we're transitioning
                "@typescript-eslint/no-explicit-any": "off",
                // We're okay with assertion errors when we ask for them
                "@typescript-eslint/no-non-null-assertion": "off",

                // Ban matrix-js-sdk/src imports in favour of matrix-js-sdk/src/matrix imports to prevent unleashing hell.
                "no-restricted-imports": [
                    "error",
                    {
                        paths: [
                            {
                                name: "matrix-js-sdk",
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                            {
                                name: "matrix-js-sdk/",
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                            {
                                name: "matrix-js-sdk/src",
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                            {
                                name: "matrix-js-sdk/src/",
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                            {
                                name: "matrix-js-sdk/src/index",
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                        ],
                        patterns: [
                            {
                                group: ["matrix-js-sdk/lib", "matrix-js-sdk/lib/", "matrix-js-sdk/lib/**"],
                                message: "Please use matrix-js-sdk/src/* instead",
                            },
                        ],
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
