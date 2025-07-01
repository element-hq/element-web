import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
    stories: ["../src/shared-components/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    staticDirs: ["../webapp"],
    addons: [
        "@storybook/addon-docs",
        "@storybook/addon-designs",
        {
            name: "@storybook/addon-styling-webpack",
            options: {
                rules: [
                    {
                        test: /\.module.css$/,
                        use: [
                            "style-loader",
                            {
                                loader: "css-loader",
                                options: {
                                    importLoaders: 1,
                                    modules: {
                                        namedExport: false,
                                    },
                                },
                            },
                        ],
                    },
                    // Replaces existing CSS rules with given rule
                    {
                        test: /\.p?css$/,
                        exclude: /\.module.css$/,
                        use: ["style-loader", "css-loader"],
                    },
                ],
            },
        },
    ],
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
                    $webapp: path.resolve(__dirname, "../webapp"),
                },
            },
            // Needed for counterpart to work
            plugins: [nodePolyfills({ include: ["process", "util"] })],
        });
    },
};
export default config;
