import { KnipConfig } from "knip";

export default {
    entry: [
        "src/serviceworker/index.ts",
        "src/workers/*.worker.ts",
        "src/utils/exportUtils/exportJS.js",
        "scripts/**",
        "playwright/**",
        "test/**",
        "res/decoder-ring/**",
        "res/jitsi_external_api.min.js",
        "docs/**",
    ],
    project: ["**/*.{js,ts,jsx,tsx}"],
    ignore: [
        // Keep for now
        "src/hooks/useLocalStorageState.ts",
        "src/hooks/useTimeout.ts",
        "src/components/views/elements/InfoTooltip.tsx",
        "src/components/views/elements/StyledCheckbox.tsx",
    ],
    ignoreDependencies: [
        // Required for `action-validator`
        "@action-validator/*",
        // Used for git pre-commit hooks
        "husky",
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

        // Used by matrix-js-sdk, which means we have to include them as a
        // dependency so that // we can run `tsc` (since we import the typescript
        // source of js-sdk, rather than the transpiled and annotated JS like you
        // would with a normal library).
        "@types/content-type",
        "@types/sdp-transform",
    ],
    ignoreBinaries: [
        // Used in scripts & workflows
        "jq",
        "wait-on",
    ],
    ignoreExportsUsedInFile: true,
} satisfies KnipConfig;
