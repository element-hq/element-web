import { KnipConfig } from "knip";

// Specify this as knip loads config files which may conditionally add reporters, e.g. `@casualbot/jest-sonar-reporter'
process.env.GITHUB_ACTIONS = "1";

export default {
    workspaces: {
        "packages/shared-components": {},
        "packages/playwright-common": {
            ignore: [
                // Used in build-and-test playwright merge-reports
                "flaky-reporter.ts",
            ],
            ignoreDependencies: [
                // Used in playwright-screenshots.sh
                "wait-on",
            ],
            ignoreBinaries: ["awk"],
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
                "res/themes/*/css/*.pcss",
            ],
            ignore: [
                // Keep for now
                "src/hooks/useLocalStorageState.ts",
            ],
            ignoreDependencies: [
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
        },
        "apps/desktop": {
            entry: ["src/preload.cts", "electron-builder.ts", "scripts/**", "hak/**"],
            project: ["**/*.{js,ts}"],
            ignoreDependencies: [
                // Brought in via hak scripts
                "matrix-seshat",
            ],
            ignoreBinaries: ["scripts/in-docker.sh"],
        },
        ".": {
            entry: ["scripts/**", "docs/**"],
        },
    },
    ignoreExportsUsedInFile: true,
    compilers: {
        pcss: (text: string) =>
            [...text.matchAll(/(?<=@)import[^;]+/g)]
                .map(([line]) => {
                    if (line.startsWith("import url(")) {
                        return line.replace("url(", "").slice(0, -1);
                    }
                    return line;
                })
                .join("\n"),
    },
    nx: {
        config: ["{nx,package,project}.json", "{apps,packages,modules}/**/{package,project}.json"],
    },
    playwright: {
        config: ["playwright.config.ts", "playwright-merge.config.ts"],
    },
    tags: ["-knipignore"],
} satisfies KnipConfig;
