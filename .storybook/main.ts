import type { StorybookConfig } from "@storybook/react-webpack5";
import { createRequire } from "node:module";
import webpack from "webpack";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
    stories: ["../src/shared/**/*.mdx", "../src/shared/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    staticDirs: ["../webapp"],
    addons: [
        "@storybook/addon-webpack5-compiler-swc",
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
    framework: "@storybook/react-webpack5",
    core: {
        disableTelemetry: true,
    },
    typescript: {
        reactDocgen: "react-docgen-typescript",
    },
    webpackFinal(config) {
        config.plugins = [
            ...(config.plugins || []),
            // Needed for counterpart to work
            new webpack.ProvidePlugin({
                util: require.resolve("util/"),
                process: require.resolve("process/browser"),
            }),
        ];
        config.resolve = {
            ...(config.resolve || {}),
            alias: {
                ...(config.resolve?.alias || {}),
                // Alias used by i18n.tsx
                $webapp: path.resolve(__dirname, "../webapp"),
            },
        };
        return config;
    },
};

export default config;
