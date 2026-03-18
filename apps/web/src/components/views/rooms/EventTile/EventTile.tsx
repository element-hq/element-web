/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { EventType, Relations, RelationType, RoomMember } from "matrix-js-sdk/src/matrix";
import { Layout } from "../../../../settings/enums/Layout";
import TileErrorBoundary from "../../messages/TileErrorBoundary";
import { EventTilePresenter, type EventTileProps as EventTilePresenterProps } from "./EventTilePresenter";

export type { EventTileHandle, EventTileOps, EventTileApi } from "./EventTilePresenter";

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface ReadReceiptProps {
    userId: string;
    roomMember: RoomMember | null;
    ts: number;
}

export interface EventTileProps extends EventTilePresenterProps {
    withErrorBoundary?: boolean;
}

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

export default EventTile;
