/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { Layout } from "../../../../settings/enums/Layout";
import TileErrorBoundary from "../../messages/TileErrorBoundary";
import { EventTilePresenter, type EventTileProps as EventTilePresenterProps } from "./EventTilePresenter";

export type { EventTileHandle } from "./EventTilePresenter";
export type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";

/**
 * Props for the exported {@link EventTile} wrapper component.
 */
export interface EventTileProps extends EventTilePresenterProps {
    /**
     * Wraps the tile in the timeline error boundary when enabled.
     */
    withErrorBoundary?: boolean;
}

/**
 * Renders a timeline event tile and optionally protects it with the tile error boundary.
 */
export function EventTile(props: EventTileProps): JSX.Element {
    const { withErrorBoundary = true, layout = Layout.Group, forExport = false, ...rest } = props;
    const tileProps = { ...rest, layout, forExport };
    const tile = <EventTilePresenter {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <TileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout}>
            {tile}
        </TileErrorBoundary>
    );
}
