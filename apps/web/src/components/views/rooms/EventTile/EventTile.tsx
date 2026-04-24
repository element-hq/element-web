/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { Layout } from "../../../../settings/enums/Layout";
import { EventTileErrorBoundary } from "./EventTileErrorBoundary";
import { EventTileHost, type EventTileHostProps, type EventTileHandle } from "./EventTileHost";

export type { EventTileHandle };

/** Props for {@link EventTile}. */
export interface EventTileProps extends EventTileHostProps {
    /** Wraps the tile in {@link EventTileErrorBoundary}. Defaults to `true`. */
    withErrorBoundary?: boolean;
}

/** Renders a single timeline event tile directly from its view model. */
export function EventTile(props: Readonly<EventTileProps>): JSX.Element {
    const { withErrorBoundary = true, layout = Layout.Group, forExport = false, ...rest } = props;
    const tileProps = { ...rest, layout, forExport };
    const tile = <EventTileHost {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <EventTileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout}>
            {tile}
        </EventTileErrorBoundary>
    );
}
