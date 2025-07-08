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
