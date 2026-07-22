/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { defineConfig } from "oxlint";

const defaultRestrictedProperties = [
    { object: "window", property: "setImmediate", message: "Use setTimeout instead" },
    // TODO we will enable this in a follow up PR
    // ...buildRestrictedPropertiesOptions(["React.forwardRef", "*.forwardRef", "forwardRef"], "Use ref props instead."),
] as const;
const defaultRestrictedGlobals = [
    {
        name: "setImmediate",
        message: "Use setTimeout instead.",
    },
];

export default defineConfig({
    $schema: "./node_modules/oxlint/configuration_schema.json",
    plugins: [
        "eslint",
        "typescript",
        "unicorn",
        "import",
        "jsdoc",
        "node",
        "promise",
        "vitest",
        "react",
        "react-perf",
        "jsx-a11y",
    ],
    jsPlugins: ["eslint-plugin-element-call"],
    categories: {
        correctness: "error",
        perf: "error",
    },
    options: {
        typeAware: true,
        reportUnusedDisableDirectives: "warn",
        maxWarnings: 0,
        denyWarnings: true,
    },
    env: {
        es6: true,
    },
    ignorePatterns: [
        "**/lib",
        "**/dist",
        "**/node_modules",
        "**/coverage",
        "apps/web/src/vector/modernizr.cjs",
        // Legacy skinning file that some people might still have
        "apps/web/src/component-index.js",
        // Auto-generated files
        "apps/web/src/modules.ts",
        "apps/web/src/modules.js",
        // Test result files
        "**/test-results",
        "**/html-report",
        // Shared components generated files
        "/packages/shared-components/dist/",
        "/packages/shared-components/src/i18n/i18nKeys.d.ts",
        "/packages/shared-components/typedoc/",
    ],
    settings: {
        jsdoc: {
            tagNamePreference: {
                remark: "remarks",
                privateRemarks: "privateRemarks",
                experimental: "experimental",
                deprecated: "deprecated",
                typeParam: "typeParam",
                defaultValue: "defaultValue",
                packageDocumentation: "packageDocumentation",
                alpha: "alpha",
                knipignore: "knipignore",
                resolves: "resolves",
            },
        },
    },
    rules: {
        "no-constant-condition": ["error", { checkLoops: "allExceptWhileTrue" }],
        "typescript/unbound-method": ["error", { ignoreStatic: true }],
        "typescript/no-empty-object-type": [
            "error",
            {
                allowInterfaces: "with-single-extends",
            },
        ],
        "prefer-const": ["error", { destructuring: "all" }],
        "import/first": "error",
        "typescript/no-require-imports": "error",
        "new-cap": "error",
        "no-empty-pattern": "error",
        "typescript/no-unsafe-function-type": "error",
        "react/rules-of-hooks": "error",
        "no-extend-native": "error",
        "no-inner-declarations": "error",
        "no-var": "error",
        "typescript/no-unnecessary-type-constraint": "error",
        "jsx-filename-extension": ["error", { allow: "as-needed", extensions: ["tsx"] }],

        "unicorn/no-instanceof-array": "error",
        "no-restricted-globals": ["error", ...defaultRestrictedGlobals],
        "no-restricted-properties": ["error", ...defaultRestrictedProperties],
        "import/no-duplicates": ["error"],

        "element-call/copyright-header": [
            "error",
            "/*\nCopyright %%CURRENT_YEAR%% Element Creations Ltd.\n\nSPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial\nPlease see LICENSE in the repository root for full details.\n*/\n\n",
        ],

        // Allow the use of underscore to show args are not used.
        // This is helpful for seeing that a function implements
        // an interface but won't be using one of it's arguments.
        "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],

        // Require method signatures to be explicit to help make signature changes more obvious in review
        "typescript/explicit-function-return-type": [
            "error",
            {
                allowExpressions: true,
            },
        ],
        "typescript/explicit-member-accessibility": "error",

        // Require us to be more explicit about type conversions to help prevent bugs
        "typescript/no-base-to-string": ["error"],

        // Prevent invalid non-type re-exports of types, these can cause downstream build failures
        "typescript/consistent-type-exports": ["error"],

        // Prevent unnecessary runtime dependencies between files
        "typescript/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],

        // Disable some perf rules
        "no-await-in-loop": "off",

        // Disable some opinionated rules
        "unicorn/switch-case-braces": "off",
        "sort-keys": "off",
        "typescript/require-array-sort-compare": "off",
        "eslint/no-extra-boolean-cast": "off",

        // These would be nice to enable at some point
        "unicorn/prefer-set-has": "off",
        "unicorn/prefer-string-slice": "off",
        "unicorn/prefer-number-properties": "off",
        "unicorn/prefer-at": "off",
        "unicorn/no-new-array": "off",
        "unicorn/no-array-for-each": "off",
        "unicorn/explicit-length-check": "off",
        "unicorn/catch-error-name": "off",
        "require-unicode-regexp": "off",
        "typescript/restrict-template-expressions": "off",
        "typescript/no-redundant-type-constituents": "off",
        "typescript/no-useless-default-assignment": "off",
        "typescript/no-duplicate-type-constituents": "off",
        "typescript/no-floating-promises": "off",
        "typescript/no-implied-eval": "off",
        "typescript/no-misused-spread": "off",
        "promise/valid-params": "off",
        "no-extra-boolean-cast": "off",
        "react-perf/jsx-no-new-function-as-prop": "off",
        "react-perf/jsx-no-new-object-as-prop": "off",
        "react-perf/jsx-no-jsx-as-prop": "off",
        "jsx-a11y/prefer-tag-over-role": "off",
        "jsx-a11y/no-autofocus": "off",
        "react/no-children-prop": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "react-perf/jsx-no-new-array-as-prop": "off",
        "react/no-did-update-set-state": "off",
        "react/no-did-mount-set-state": "off",
        "jsx-a11y/no-static-element-interactions": "off",
        "vitest/no-conditional-tests": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "react/no-array-index-key": "off",
        "jsx-a11y/control-has-associated-label": "off",
        "jsx-a11y/media-has-caption": "off",
        "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
        "jsx-a11y/aria-activedescendant-has-tabindex": "off",
    },
    overrides: [
        {
            files: ["apps/web/src/**/*", "{packages,modules}/*/src/**/*"],
            rules: {
                "no-restricted-globals": [
                    "error",
                    defaultRestrictedGlobals,
                    {
                        name: "Buffer",
                        message: "Buffer is not available in the web.",
                    },
                ],
            },
        },
        {
            files: ["{packages,apps,modules}/*/src/**/*"],
            rules: {
                "no-restricted-imports": [
                    "error",
                    {
                        name: "events",
                        message: "Please use TypedEventEmitter instead",
                    },
                ],

                // Enable this in the future, it has a lot of false positives right now
                // "react/react-compiler": "error",
            },
        },
        {
            files: ["packages/shared-components/**/*"],
            rules: {
                "no-restricted-imports": [
                    "error",
                    {
                        paths: [
                            {
                                name: "react",
                                importNames: ["act"],
                                message: "Please use @test-utils instead.",
                            },
                            {
                                name: "@testing-library/react",
                                message: "Please use @test-utils instead",
                            },
                        ],
                    },
                ],

                // This would be good to apply globally in the future
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
        },
        {
            files: ["apps/web/**/*"],
            rules: {
                "no-restricted-properties": [
                    "error",
                    ...defaultRestrictedProperties,
                    ...buildRestrictedPropertiesOptions(
                        ["window.innerHeight", "window.innerWidth", "window.visualViewport"],
                        "Use UIStore to access window dimensions instead.",
                    ),
                    ...buildRestrictedPropertiesOptions(
                        ["*.mxcUrlToHttp", "*.getHttpUriForMxc"],
                        "Use Media helper instead to centralise access for customisation.",
                    ),
                ],

                // Ban matrix-js-sdk/src imports in favour of matrix-js-sdk/src/matrix imports to prevent unleashing hell.
                // Ban compound-design-tokens raw svg imports in favour of their React component counterparts
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
                            {
                                name: "emojibase-regex",
                                message:
                                    "This regex doesn't actually test for emoji. See the docs at https://emojibase.dev/docs/regex/ and prefer our own EMOJI_REGEX from HtmlUtils.",
                            },
                        ],
                        patterns: [
                            {
                                group: [
                                    "matrix-js-sdk/src/**",
                                    "!matrix-js-sdk/src/matrix",
                                    "!matrix-js-sdk/src/crypto-api",
                                    "!matrix-js-sdk/src/types",
                                    "!matrix-js-sdk/src/testing",
                                    "!matrix-js-sdk/src/utils/**",
                                    "matrix-js-sdk/src/utils/internal/**",
                                    "matrix-js-sdk/lib",
                                    "matrix-js-sdk/lib/",
                                    "matrix-js-sdk/lib/**",
                                    // XXX: Temporarily allow these as they are not available via the main export
                                    "!matrix-js-sdk/src/logger",
                                    "!matrix-js-sdk/src/errors",
                                    "!matrix-js-sdk/src/utils",
                                    "!matrix-js-sdk/src/version-support",
                                    "!matrix-js-sdk/src/randomstring",
                                    "!matrix-js-sdk/src/sliding-sync",
                                    "!matrix-js-sdk/src/browser-index",
                                    "!matrix-js-sdk/src/feature",
                                    "!matrix-js-sdk/src/NamespacedValue",
                                    "!matrix-js-sdk/src/ReEmitter",
                                    "!matrix-js-sdk/src/event-mapper",
                                    "!matrix-js-sdk/src/interactive-auth",
                                    "!matrix-js-sdk/src/secret-storage",
                                    "!matrix-js-sdk/src/room-hierarchy",
                                    "!matrix-js-sdk/src/rendezvous",
                                    "!matrix-js-sdk/src/indexeddb-worker",
                                    "!matrix-js-sdk/src/pushprocessor",
                                    "!matrix-js-sdk/src/extensible_events_v1",
                                    "!matrix-js-sdk/src/extensible_events_v1/PollStartEvent",
                                    "!matrix-js-sdk/src/extensible_events_v1/PollResponseEvent",
                                    "!matrix-js-sdk/src/extensible_events_v1/PollEndEvent",
                                    "!matrix-js-sdk/src/extensible_events_v1/InvalidEventError",
                                    "!matrix-js-sdk/src/oidc",
                                    "!matrix-js-sdk/src/oidc/discovery",
                                    "!matrix-js-sdk/src/oidc/authorize",
                                    "!matrix-js-sdk/src/oidc/validate",
                                    "!matrix-js-sdk/src/oidc/error",
                                    "!matrix-js-sdk/src/oidc/register",
                                    "!matrix-js-sdk/src/webrtc",
                                    "!matrix-js-sdk/src/webrtc/call",
                                    "!matrix-js-sdk/src/webrtc/callFeed",
                                    "!matrix-js-sdk/src/webrtc/mediaHandler",
                                    "!matrix-js-sdk/src/webrtc/callEventTypes",
                                    "!matrix-js-sdk/src/webrtc/callEventHandler",
                                    "!matrix-js-sdk/src/webrtc/groupCallEventHandler",
                                    "!matrix-js-sdk/src/models",
                                    "!matrix-js-sdk/src/models/read-receipt",
                                    "!matrix-js-sdk/src/models/relations-container",
                                    "!matrix-js-sdk/src/models/related-relations",
                                    "!matrix-js-sdk/src/matrixrtc",
                                ],
                                message: "Please use matrix-js-sdk/src/matrix instead",
                            },
                            {
                                group: ["emojibase-regex/emoji*"],
                                message:
                                    "This regex doesn't actually test for emoji. See the docs at https://emojibase.dev/docs/regex/ and prefer our own EMOJI_REGEX from HtmlUtils.",
                            },
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
            },
        },
        {
            files: [
                "apps/*/playwright/**/*",
                "packages/playwright-common/**/*",
                "modules/*/e2e/**/*",
                "modules/playwright/**/*",
            ],
            rules: {
                // This is a common pattern for Playwright fixtures
                "no-empty-pattern": "off",
                // Playwright has a `use` method for fixtures which confuses this rule
                "react-hooks/rules-of-hooks": "off",
            },
        },
        {
            files: [
                "{packages,apps,modules}/*/src/**/*.{test,stories}.{ts,tsx}",
                "{packages,apps,modules}/*/src/{tests,test}/*.{ts,tsx}",
                "{packages,apps,modules}/*/src/**/__mocks__/*.{ts,tsx}",
                "{packages,apps,modules}/*/{test,playwright,e2e}/**/*",
                "{packages,apps,modules}/*/playwright.config.ts",
                "{packages,apps,modules}/*/.storybook/**/*",
                "packages/playwright-common/src/**/*",
            ],
            rules: {
                // Tests can be linted a little more flexibly
                // We don't need super strict typing in test utilities
                "no-import-assign": "off",
                "no-unsafe-optional-chaining": "off",
                "typescript/no-empty-object-type": "off",
                "typescript/unbound-method": "off",
                "typescript/no-floating-promises": "off",
                "typescript/no-misused-spread": "off",
                "vitest/require-mock-type-parameters": "off",
                "vitest/no-disabled-tests": "off",
                "vitest/no-conditional-expect": "off",
                "vitest/warn-todo": "off",
                "vitest/require-to-throw-message": "off",
                "vitest/prefer-snapshot-hint": "off",
                "vitest/no-standalone-expect": [
                    "error",
                    {
                        additionalTestBlockFunctions: ["beforeAll", "beforeEach"],
                    },
                ],
                "vitest/expect-expect": [
                    "error",
                    {
                        assertFunctionNames: ["expect*", "*Test", "assert*", "test*Factory"],
                    },
                ],
                "jsdoc/check-tag-names": "off",
                "typescript/explicit-function-return-type": "off",
                "typescript/explicit-member-accessibility": "off",

                // Disable a11y rules for components in tests
                "jsx-a11y/role-has-required-aria-props": "off",
                "jsx-a11y/interactive-supports-focus": "off",
                "jsx-a11y/no-static-element-interactions": "off",
                "jsx-a11y/click-events-have-key-events": "off",
                "jsx-a11y/media-has-caption": "off",
                "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
                "jsx-a11y/role-supports-aria-props": "off",

                "react/jsx-no-constructed-context-values": "off",
                "react/no-array-index-key": "off",
                "react/forbid-elements": "off",
                // This would be good to enable in the future
                "typescript/await-thenable": "off",
                "promise/no-callback-in-promise": "off",
            },
        },
        {
            files: ["{packages,apps,modules}/*/src/**/*.stories.{ts,tsx}"],
            jsPlugins: ["eslint-plugin-element-call", "eslint-plugin-storybook"],
            rules: {
                "storybook/meta-satisfies-type": "error",
                "storybook/default-exports": "error",
                "storybook/hierarchy-separator": "error",
                "storybook/no-redundant-story-name": "error",
                "storybook/no-renderer-packages": "error",
                "storybook/no-stories-of": "error",
                "storybook/story-exports": "error",
                "storybook/use-storybook-expect": "error",
                "storybook/use-storybook-testing-library": "error",
                "storybook/no-uninstalled-addons": "error",
                "jsx-filename-extension": ["error", { allow: "always", extensions: ["tsx"] }],
            },
        },
        {
            files: ["**/*.{cjs,js}"],
            rules: {
                "typescript/no-require-imports": "off",
            },
        },
    ],
});

function buildRestrictedPropertiesOptions(
    properties: string[],
    message: string,
): { object?: string; property: string; message: string }[] {
    return properties.map((prop) => {
        const [object, property] = prop.split(".");
        return {
            object: object === "*" ? undefined : object,
            property,
            message,
        };
    });
}
