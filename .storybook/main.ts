/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
    stories: ["../src/shared-components/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: ["@storybook/addon-docs", "@storybook/addon-designs"],
    framework: "@storybook/react-vite",
    core: {
        disableTelemetry: true,
    },
    typescript: {
        reactDocgen: "react-docgen-typescript",
    },
};
export default config;
