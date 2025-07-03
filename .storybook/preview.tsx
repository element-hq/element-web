import type { ArgTypes, Preview, Decorator } from "@storybook/react-vite";

import "../res/css/shared.pcss";
import "./preview.css";
import React, { useLayoutEffect } from "react";

export const globalTypes = {
    theme: {
        name: "Theme",
        defaultValue: "system",
        description: "Global theme for components",
        toolbar: {
            icon: "circlehollow",
            title: "Theme",
            items: [
                { title: "System", value: "system", icon: "browser" },
                { title: "Light", value: "light", icon: "sun" },
                { title: "Light (high contrast)", value: "light-hc", icon: "sun" },
                { title: "Dark", value: "dark", icon: "moon" },
                { title: "Dark (high contrast)", value: "dark-hc", icon: "moon" },
            ],
        },
    },
} satisfies ArgTypes;

const allThemesClasses = globalTypes.theme.toolbar.items.map(({ value }) => `cpd-theme-${value}`);

const ThemeSwitcher: React.FC<{
    theme: string;
}> = ({ theme }) => {
    useLayoutEffect(() => {
        document.documentElement.classList.remove(...allThemesClasses);
        if (theme !== "system") {
            document.documentElement.classList.add(`cpd-theme-${theme}`);
        }
        return () => document.documentElement.classList.remove(...allThemesClasses);
    }, [theme]);

    return null;
};

const withThemeProvider: Decorator = (Story, context) => {
    return (
        <>
            <ThemeSwitcher theme={context.globals.theme} />
            <Story />
        </>
    );
};

const preview: Preview = {
    tags: ["autodocs"],
    decorators: [withThemeProvider],
};

export default preview;
