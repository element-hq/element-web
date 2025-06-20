import type { Preview } from "@storybook/react-webpack5";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../res/css/shared.pcss";
import "./preview.css";

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
    decorators: [
        withThemeByClassName({
            themes: {
                "light": "cpd-theme-light",
                "dark": "cpd-theme-dark",
                "light-high-contrast": "cpd-theme-light-hc",
                "dark-high-contrast": "cpd-theme-dark-hc",
            },
            defaultTheme: "light",
        }),
    ],
};

export default preview;
