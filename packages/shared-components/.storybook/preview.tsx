/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { ArgTypes, Decorator, Preview, ReactRenderer, StrictArgs } from "@storybook/react-vite";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import "./compound.css";
import "./preview.css";
import React, { useLayoutEffect } from "react";
import { TooltipProvider } from "@vector-im/compound-web";
import type { StoryContext } from "storybook/internal/csf";

import { EventPresentationProvider, type EventDensity, type EventLayout, I18nApi, I18nContext } from "../src";
import { setLanguage } from "../src/core/i18n/i18n";

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
    eventLayout: {
        name: "Event layout",
        description: "Global event layout for timeline components",
        toolbar: {
            icon: "component",
            title: "Event layout",
            items: [
                { title: "Group", value: "group" },
                { title: "Bubble", value: "bubble" },
                { title: "IRC", value: "irc" },
            ],
        },
    },
    eventDensity: {
        name: "Event density",
        description: "Global event density for timeline components",
        toolbar: {
            icon: "listunordered",
            title: "Event density",
            items: [
                { title: "Default", value: "default" },
                { title: "Compact", value: "compact" },
            ],
        },
    },
    initialGlobals: {
        theme: "system",
        language: "en",
        eventLayout: "group",
        eventDensity: "default",
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

const withEventPresentationProvider: Decorator = (Story, context) => {
    return (
        <EventPresentationProvider
            value={{
                layout: context.globals.eventLayout as EventLayout,
                density: context.globals.eventDensity as EventDensity,
            }}
        >
            <Story />
        </EventPresentationProvider>
    );
};

const preview = {
    tags: ["autodocs", "snapshot"],
    initialGlobals: {
        theme: "system",
        language: "en",
        eventLayout: "group",
        eventDensity: "default",
    },
    decorators: [withThemeProvider, withEventPresentationProvider, withTooltipProvider, withI18nProvider],
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
} satisfies Preview;

export default preview;
