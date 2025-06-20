import type { StorybookConfig } from "@storybook/react-webpack5";

const config: StorybookConfig = {
    stories: ["../src/shared/**/*.mdx", "../src/shared/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
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
};
export default config;
