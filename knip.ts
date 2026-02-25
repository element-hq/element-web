import { KnipConfig } from "knip";

export default {
    workspaces: {
        "packages/shared-components": {
            entry: ["src/index.ts"],
            ignoreBinaries: [
                // False positives
                "vite",
                "typedoc",
            ],
            ignoreDependencies: [
                // We import this in some tests, transitive dep of @playwright/test
                "playwright-core",
                // False positives
                "@testing-library/jest-dom",
                "@vitejs/plugin-react",
                "expect",
                "vitest-browser-react",
                "vitest-sonar-reporter",
            ],
        },
        "packages/playwright-common": {
            entry: ["playwright-screenshots.sh"],
            ignoreDependencies: ["@playwright/test", "wait-on"],
        },
        "apps/web": {
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
            ignoreBinaries: [
                // False positive
                "webpack-dev-server",
            ],
            ignoreDependencies: [
                // Used by jest
                "babel-jest",
                // Used by babel
                "@babel/runtime",
                "@babel/plugin-transform-class-properties",
                // Referenced in PCSS
                "github-markdown-css",
                // False positive
                "sw.js",
                // Used by webpack
                "process",
                "util",
                // Embedded into webapp
                "@element-hq/element-call-embedded",
                // False-positive jest dep
                "vitest-environment-jest-fixed-jsdom",

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
            ignoreBinaries: ["lint:types", "lint:js", "lint:style"],
            ignoreDependencies: [
                // Required for `action-validator`
                "@action-validator/*",
                // Used for git pre-commit hooks
                "husky",
            ],
        },
    },
    ignoreBinaries: [
        // False positives
        "playwright",
        "build:storybook",
        "test:storybook",
        "test:unit",
        "vendor:jitsi",
    ],
    ignoreExportsUsedInFile: true,
    nx: {
        config: ["nx.json", "project.json", "{apps,packages,modules}/**/project.json", "package.json"],
    },
} satisfies KnipConfig;
