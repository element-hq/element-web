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
import "./app-web-root.css";
import "./preview.css";
import React, { useLayoutEffect } from "react";
import { TooltipProvider } from "@vector-im/compound-web";

import { EventPresentationProvider, type EventDensity, type EventLayout, I18nApi, I18nContext } from "../src";
import { setLanguage } from "../src/core/i18n/i18n";
import { type StoryContext } from "storybook/internal/csf";
import { DragDropProvider } from "@dnd-kit/react";
import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";

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
                { title: "Modern", value: "group" },
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
    rootCss: {
        name: "Root CSS",
        description: "Global root CSS for component previews",
        toolbar: {
            icon: "paintbrush",
            title: "Root CSS",
            items: [
                { title: "Default", value: "storybook" },
                { title: "Element Web", value: "app-web" },
            ],
        },
    },
    initialGlobals: {
        theme: "light",
        language: "en",
        eventLayout: "group",
        eventDensity: "default",
        rootCss: "storybook",
    },
} satisfies ArgTypes;

const allThemesClasses = globalTypes.theme.toolbar.items.map(({ value }) => `cpd-theme-${value}`);

const RootCssSwitcher: React.FC<{
    rootCss: string;
}> = ({ rootCss }) => {
    useLayoutEffect(() => {
        if (rootCss === "app-web") {
            document.documentElement.dataset.storybookRootCss = rootCss;
        } else {
            delete document.documentElement.dataset.storybookRootCss;
        }

        return () => {
            delete document.documentElement.dataset.storybookRootCss;
        };
    }, [rootCss]);

    return null;
};

const ThemeSwitcher: React.FC<{
    theme: string;
}> = ({ theme }) => {
    useLayoutEffect(() => {
        document.body.classList.remove(...allThemesClasses);
        if (theme !== "system") {
            document.body.classList.add(`cpd-theme-${theme}`);
        }
        return () => document.body.classList.remove(...allThemesClasses);
    }, [theme]);

    return null;
};

const withRootCss: Decorator = (Story, context) => {
    return (
        <>
            <RootCssSwitcher rootCss={context.globals.rootCss} />
            <Story />
        </>
    );
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

/**
 * Wrap all stories in a DragDropProvider that excludes the Accessibility plugin.
 * dnd-kit's Accessibility plugin adds aria attributes (tabindex, aria-pressed, etc.)
 * that conflict with the existing ARIA roles used in the room list components.
 */
const withDragDropProvider: Decorator = (Story) => {
    return (
        <DragDropProvider
            sensors={[
                // By default, the PointerSensor activates dragging immediately on pointer down, which interferes with keyboard navigation.
                // So we start dragging after the pointer has moved by 5 pixels, to allow for click without dragging
                PointerSensor.configure({
                    activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
                }),
            ]}
        >
            <Story />
        </DragDropProvider>
    );
};

const preview: Preview = {
    tags: ["autodocs", "snapshot"],
    initialGlobals: {
        rootCss: "storybook",
        theme: "light",
        language: "en",
        eventLayout: "group",
        eventDensity: "default",
    },
    decorators: [
        withRootCss,
        withThemeProvider,
        withEventPresentationProvider,
        withTooltipProvider,
        withI18nProvider,
        withDragDropProvider,
    ],
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
