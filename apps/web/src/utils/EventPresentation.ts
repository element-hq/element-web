/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventLayout, EventPresentation } from "@element-hq/web-shared-components";
import { Layout } from "../settings/enums/Layout";

const EVENT_LAYOUT_BY_APP_LAYOUT: Record<Layout, EventLayout> = {
    [Layout.Bubble]: "bubble",
    [Layout.Group]: "group",
    [Layout.IRC]: "irc",
};

/** Converts app/web layout settings into shared event presentation settings. */
export function getEventPresentation(layout: Layout, useCompactLayout: boolean): EventPresentation {
    return {
        layout: EVENT_LAYOUT_BY_APP_LAYOUT[layout],
        density: useCompactLayout && layout === Layout.Group ? "compact" : "default",
    };
}
