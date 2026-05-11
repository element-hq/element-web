/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createContext, useContext } from "react";

/** Event tile layout selected by the host surface. */
export type EventLayout = "group" | "bubble" | "irc";

/** Density variant applied within an event layout. */
export type EventDensity = "default" | "compact";

/** Presentation settings that shared event/timeline components can adapt to. */
export interface EventPresentation {
    /** Layout family used for event rendering. */
    layout: EventLayout;
    /** Spacing density used within the layout. */
    density: EventDensity;
}

/** Default event presentation used when no provider is present. */
export const DEFAULT_EVENT_PRESENTATION: EventPresentation = {
    layout: "group",
    density: "default",
};

const EventPresentationContext = createContext<EventPresentation>(DEFAULT_EVENT_PRESENTATION);
EventPresentationContext.displayName = "EventPresentationContext";

/** Provides event presentation settings to shared event/timeline components. */
export const EventPresentationProvider = EventPresentationContext.Provider;

/** Returns the current event presentation settings. */
export function useEventPresentation(): EventPresentation {
    return useContext(EventPresentationContext);
}
