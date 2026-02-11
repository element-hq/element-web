import { KnipConfig } from "knip";

export default {
    workspaces: {
        "packages/shared-components": {
            entry: ["src/index.ts"],
            ignoreDependencies: [
                // We import this in some tests, transitive dep of @playwright/test
                "playwright-core",
                // Needed by storybook-addon-vite
                "expect",
            ],
        },
        "apps/element-web": {
            entry: [
                "src/serviceworker/index.ts",
                "src/workers/*.worker.ts",
                "src/utils/exportUtils/exportJS.js",
                "src/vector/localstorage-fix.ts",
                "scripts/**",
                "playwright/**",
                "test/**",
                "res/decoder-ring/**",
                "res/jitsi_external_api.min.js",
            ],
            ignore: [
                // Keep for now
                "src/hooks/useLocalStorageState.ts",
                "src/hooks/useTimeout.ts",
                "src/components/views/elements/InfoTooltip.tsx",
                "src/components/views/elements/StyledCheckbox.tsx",
            ],
            ignoreDependencies: [
                // Referenced in PCSS
                "github-markdown-css",
                // False positive
                "sw.js",
                // Embedded into webapp
                "@element-hq/element-call-embedded",
                // Transitive dep of jest
                "vitest-environment-jest-fixed-jsdom",
                // Used by jest
                "babel-jest",
                // Used by babel
                "@babel/runtime",
                "@babel/plugin-transform-class-properties",
                // Used by webpack
                "process",
                "util",
                // We import this in some tests, transitive dep of @playwright/test
                "playwright-core",

                // Used by matrix-js-sdk, which means we have to include them as a
                // dependency so that // we can run `tsc` (since we import the typescript
                // source of js-sdk, rather than the transpiled and annotated JS like you
                // would with a normal library).
                "@types/content-type",
                "@types/sdp-transform",
            ],
        },
        ".": {
            entry: ["scripts/**", "docs/**"],
            ignoreDependencies: [
                // Required for `action-validator`
                "@action-validator/*",
                // Used for git pre-commit hooks
                "husky",
            ],
        },
    },
    ignoreBinaries: ["test:storybook", "build:storybook", "playwright"],
    ignoreDependencies: [],
    ignoreExportsUsedInFile: true,
    treatConfigHintsAsErrors: true,
} satisfies KnipConfig;
