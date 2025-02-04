module.exports = {
    plugins: ["matrix-org", "eslint-plugin-react-compiler"],
    extends: ["plugin:matrix-org/babel", "plugin:matrix-org/react", "plugin:matrix-org/a11y"],
    parserOptions: {
        project: ["./tsconfig.json"],
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
        // Ban matrix-js-sdk/src imports in favour of matrix-js-sdk/src/matrix imports to prevent unleashing hell.
        // Ban compound-design-tokens raw svg imports in favour of their React component counterparts
        "no-restricted-imports": [
            "error",
            {
                paths: [
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
            files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}", "playwright/**/*.ts"],
            extends: ["plugin:matrix-org/typescript", "plugin:matrix-org/react"],
            rules: {
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
        // temporary override for offending icon require files
        {
            files: [
                "src/SdkConfig.ts",
                "src/components/structures/FileDropTarget.tsx",
                "src/components/structures/RoomStatusBar.tsx",
                "src/components/structures/UserMenu.tsx",
                "src/components/views/avatars/WidgetAvatar.tsx",
                "src/components/views/dialogs/AddExistingToSpaceDialog.tsx",
                "src/components/views/dialogs/ForwardDialog.tsx",
                "src/components/views/dialogs/InviteDialog.tsx",
                "src/components/views/dialogs/ModalWidgetDialog.tsx",
                "src/components/views/dialogs/UploadConfirmDialog.tsx",
                "src/components/views/dialogs/security/SetupEncryptionDialog.tsx",
                "src/components/views/elements/AddressTile.tsx",
                "src/components/views/elements/AppWarning.tsx",
                "src/components/views/elements/SSOButtons.tsx",
                "src/components/views/messages/MAudioBody.tsx",
                "src/components/views/messages/MImageBody.tsx",
                "src/components/views/messages/MFileBody.tsx",
                "src/components/views/messages/MStickerBody.tsx",
                "src/components/views/messages/MVideoBody.tsx",
                "src/components/views/messages/MVoiceMessageBody.tsx",
                "src/components/views/right_panel/EncryptionPanel.tsx",
                "src/components/views/rooms/EntityTile.tsx",
                "src/components/views/rooms/LinkPreviewGroup.tsx",
                "src/components/views/rooms/MemberList.tsx",
                "src/components/views/rooms/MessageComposer.tsx",
                "src/components/views/rooms/ReplyPreview.tsx",
                "src/components/views/settings/tabs/room/SecurityRoomSettingsTab.tsx",
                "src/components/views/settings/tabs/user/GeneralUserSettingsTab.tsx",
            ],
            rules: {
                "@typescript-eslint/no-var-requires": "off",
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
