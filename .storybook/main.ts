/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
    stories: ["../src/shared-components/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    staticDirs: ["../webapp"],
    addons: ["@storybook/addon-docs", "@storybook/addon-designs", "@storybook/addon-a11y"],
    framework: "@storybook/react-vite",
    core: {
        disableTelemetry: true,
    },
    typescript: {
        reactDocgen: "react-docgen-typescript",
    },
    async viteFinal(config) {
        return mergeConfig(config, {
            resolve: {
                alias: {
                    // Alias used by i18n.tsx
                    $webapp: path.resolve("webapp"),
                },
            },
            // Needed for counterpart to work
            plugins: [nodePolyfills({ include: ["process", "util"] })],
            server: {
                allowedHosts: ["localhost", ".docker.internal"],
            },
        });
    },
};
export default config;
