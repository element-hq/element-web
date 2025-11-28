import type { ArgTypes, Preview, Decorator, ReactRenderer, StrictArgs } from "@storybook/react-vite";

import "../../../res/css/shared.pcss";
import "./preview.css";
import React, { useLayoutEffect } from "react";
import { setLanguage } from "../src/utils/i18n";
import { TooltipProvider } from "@vector-im/compound-web";
import { StoryContext } from "storybook/internal/csf";
import { I18nApi, I18nContext } from "../src";

export const globalTypes = {
    theme: {
        name: "Theme",
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
    language: {
        name: "Language",
        description: "Global language for components",
    },
    initialGlobals: {
        theme: "system",
        language: "en",
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

async function languageLoader(context: StoryContext<ReactRenderer, StrictArgs>): Promise<void> {
    await setLanguage(context.globals.language);
}

const withTooltipProvider: Decorator = (Story) => {
    return (
        <TooltipProvider>
            <Story />
        </TooltipProvider>
    );
};

const withI18nProvider: Decorator = (Story) => {
    return (
        <I18nContext.Provider value={new I18nApi()}>
            <Story />
        </I18nContext.Provider>
    );
};

const preview: Preview = {
    tags: ["autodocs"],
    decorators: [withThemeProvider, withTooltipProvider, withI18nProvider],
    parameters: {
        options: {
            storySort: {
                method: "alphabetical",
            },
        },
        a11y: {
            /*
             * Configure test behavior
             * See: https://storybook.js.org/docs/next/writing-tests/accessibility-testing#test-behavior
             */
            test: "error",
        },
    },
    loaders: [languageLoader],
};

export default preview;
