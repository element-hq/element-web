/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { Layout } from "../../../../settings/enums/Layout";
import TileErrorBoundary from "../../messages/TileErrorBoundary";
import { type EventTileProps, UnwrappedEventTile as UnwrappedEventTileComponent } from "./EventTilePresenter";

export type { EventTileHandle, EventTileProps, GetRelationsForEvent, ReadReceiptProps, EventTileOps, EventTileApi } from "./EventTilePresenter";
export { UnwrappedEventTile } from "./EventTilePresenter";

export function EventTile(props: EventTileProps): JSX.Element {
    return (
        <TileErrorBoundary mxEvent={props.mxEvent} layout={props.layout ?? Layout.Group}>
            <UnwrappedEventTileComponent {...props} />
        </TileErrorBoundary>
    );
}

export default EventTile;
