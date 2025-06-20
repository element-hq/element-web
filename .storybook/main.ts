import type { StorybookConfig } from "@storybook/react-webpack5";

const config: StorybookConfig = {
    stories: ["../src/shared/**/*.mdx", "../src/shared/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-webpack5-compiler-swc",
        "@storybook/addon-docs",
        "@storybook/addon-themes",
        "@storybook/addon-designs",
        {
            name: "@storybook/addon-styling-webpack",
            options: {
                rules: [
                    // Replaces existing CSS rules with given rule
                    {
                        test: /\.p?css$/,
                        use: ["style-loader", "css-loader"],
                    },
                ],
            },
        },
    ],
    framework: {
        name: "@storybook/react-webpack5",
        options: {},
    },
};
export default config;
