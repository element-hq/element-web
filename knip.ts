import { KnipConfig } from "knip";

export default {
    entry: [
        "src/vector/index.ts",
        "src/serviceworker/index.ts",
        "src/workers/*.worker.ts",
        "src/utils/exportUtils/exportJS.js",
        "scripts/**",
        "playwright/**",
        "test/**",
        "res/decoder-ring/**",
        "res/jitsi_external_api.min.js",
        "docs/**",
        // Used by jest
        "__mocks__/maplibre-gl.js",
    ],
    project: ["**/*.{js,ts,jsx,tsx}"],
    ignore: [
        // Keep for now
        "src/hooks/useLocalStorageState.ts",
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
    ],
    ignoreBinaries: [
        // Used in scripts & workflows
        "jq",
    ],
    ignoreExportsUsedInFile: true,
} satisfies KnipConfig;
