import type { ArgTypes, Preview, Decorator } from "@storybook/react-vite";
import { addons } from "storybook/preview-api";

import "../res/css/shared.pcss";
import "./preview.css";
import React, { useLayoutEffect } from "react";
import { FORCE_RE_RENDER } from "storybook/internal/core-events";
import { setLanguage } from "../src/shared-components/utils/i18n";
import { TooltipProvider } from "@vector-im/compound-web";

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

const LanguageSwitcher: React.FC<{
    language: string;
}> = ({ language }) => {
    useLayoutEffect(() => {
        const changeLanguage = async (language: string) => {
            await setLanguage(language);
            // Force the component to re-render to apply the new language
            addons.getChannel().emit(FORCE_RE_RENDER);
        };
        changeLanguage(language);
    }, [language]);

    return null;
};

export const withLanguageProvider: Decorator = (Story, context) => {
    return (
        <>
            <LanguageSwitcher language={context.globals.language} />
            <Story />
        </>
    );
};

const withTooltipProvider: Decorator = (Story) => {
    return (
        <TooltipProvider>
            <Story />
        </TooltipProvider>
    );
};

const preview: Preview = {
    tags: ["autodocs"],
    decorators: [withThemeProvider, withLanguageProvider, withTooltipProvider],
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
};

export default preview;
