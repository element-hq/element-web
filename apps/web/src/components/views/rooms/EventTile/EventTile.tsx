/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { Layout } from "../../../../settings/enums/Layout";
import type { ReadReceiptProps } from "../../../../viewmodels/room/EventTileViewModel";
import TileErrorBoundary from "../../messages/TileErrorBoundary";
import { EventTilePresenter, type EventTileProps as EventTilePresenterProps } from "./EventTilePresenter";

export type { EventTileHandle, GetRelationsForEvent, EventTileOps, EventTileApi } from "./EventTilePresenter";
export type { ReadReceiptProps };

export interface EventTileProps extends EventTilePresenterProps {
    withErrorBoundary?: boolean;
}

export function EventTile(props: EventTileProps): JSX.Element {
    const { withErrorBoundary = true, ...tileProps } = props;
    const tile = <EventTilePresenter {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <TileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout ?? Layout.Group}>
            {tile}
        </TileErrorBoundary>
    );
}

export default EventTile;
