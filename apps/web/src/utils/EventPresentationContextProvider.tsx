/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type PropsWithChildren, useMemo } from "react";
import { EventPresentationProvider, type EventLayout, type EventPresentation } from "@element-hq/web-shared-components";

import { Layout } from "../settings/enums/Layout";
import { useSettingValue } from "../hooks/useSettings";

const EVENT_LAYOUT_BY_APP_LAYOUT: Record<Layout, EventLayout> = {
    [Layout.Bubble]: "bubble",
    [Layout.Group]: "group",
    [Layout.IRC]: "irc",
};

function getEventDensity(layout: Layout, useCompactLayout: boolean): EventPresentation["density"] {
    return useCompactLayout && layout === Layout.Group ? "compact" : "default";
}

/** Converts app/web layout settings into shared event presentation settings. */
export function getEventPresentation(layout: Layout, useCompactLayout: boolean): EventPresentation {
    return {
        layout: EVENT_LAYOUT_BY_APP_LAYOUT[layout],
        density: getEventDensity(layout, useCompactLayout),
    };
}

/** Props for the app/web event presentation context provider. */
export interface EventPresentationContextProviderProps {
    /** Layout selected by the app/web surface rendering the timeline. */
    layout: Layout;
}

/** Provides shared event presentation using app/web-owned layout settings. */
export function EventPresentationContextProvider({
    layout,
    children,
}: Readonly<PropsWithChildren<EventPresentationContextProviderProps>>): JSX.Element {
    // Compact density is still owned by app/web; this exposes it as shared event presentation.
    const useCompactLayout = useSettingValue("useCompactLayout");
    const eventLayout = EVENT_LAYOUT_BY_APP_LAYOUT[layout];
    const density = getEventDensity(layout, useCompactLayout);
    const value = useMemo<EventPresentation>(() => ({ layout: eventLayout, density }), [eventLayout, density]);

    return <EventPresentationProvider value={value}>{children}</EventPresentationProvider>;
}
