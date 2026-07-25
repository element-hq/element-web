/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Copied from element-web/test/@test-utils because, seemingly, if we
// set that as the modules directory to use it directly, it fails to
// actually put the right thing in the context somehow.

import React, { type ReactElement } from "react";
// eslint-disable-next-line no-restricted-imports
import { render, type RenderOptions } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";

import {
    DEFAULT_EVENT_PRESENTATION,
    EventPresentationProvider,
    I18nApi,
    I18nContext,
    type EventPresentation,
} from "../..";

type SharedRenderOptions = RenderOptions & {
    presentation?: Partial<EventPresentation>;
};

const i18nApi = new I18nApi();

const wrapWithTooltipProvider = (Wrapper: RenderOptions["wrapper"], presentation?: Partial<EventPresentation>) => {
    return ({ children }: { children: React.ReactNode }) => {
        const resolvedPresentation: EventPresentation | undefined = presentation
            ? { ...DEFAULT_EVENT_PRESENTATION, ...presentation }
            : undefined;
        const content = resolvedPresentation ? (
            <EventPresentationProvider value={resolvedPresentation}>
                <TooltipProvider>{children}</TooltipProvider>
            </EventPresentationProvider>
        ) : (
            <TooltipProvider>{children}</TooltipProvider>
        );

        if (Wrapper) {
            return (
                <I18nContext.Provider value={i18nApi}>
                    <Wrapper>{content}</Wrapper>
                </I18nContext.Provider>
            );
        } else {
            return <I18nContext.Provider value={i18nApi}>{content}</I18nContext.Provider>;
        }
    };
};

const customRender = (ui: ReactElement, options: SharedRenderOptions = {}): ReturnType<typeof render> => {
    const { presentation, wrapper, ...renderOptions } = options;

    return render(ui, {
        ...renderOptions,
        wrapper: wrapWithTooltipProvider(wrapper, presentation) as RenderOptions["wrapper"],
    }) as ReturnType<typeof render>;
};

// eslint-disable-next-line no-restricted-imports
export * from "@testing-library/react";

/**
 * This custom render function wraps your component with a TooltipProvider.
 * See https://testing-library.com/docs/react-testing-library/setup/#custom-render
 */
export { customRender as render };
