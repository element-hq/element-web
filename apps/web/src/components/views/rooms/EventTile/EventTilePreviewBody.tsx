/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { DecryptionFailureBodyFactory, RedactedBodyFactory } from "../../messages/MBodyFactory";
import { EventPreviewAdapter } from "./EventPreviewAdapter";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

interface EventTilePreviewBodyProps {
    eventTileViewModel: EventTileViewModel;
    mxEvent: MatrixEvent;
}

/** Renders the compact body preview used by notification and thread-list tiles. */
export function EventTilePreviewBody({
    eventTileViewModel,
    mxEvent,
}: Readonly<EventTilePreviewBodyProps>): JSX.Element {
    return (
        <div className="mx_EventTile_body">
            {mxEvent.isRedacted() ? (
                <RedactedBodyFactory mxEvent={mxEvent} />
            ) : mxEvent.isDecryptionFailure() ? (
                <DecryptionFailureBodyFactory mxEvent={mxEvent} />
            ) : (
                <EventPreviewAdapter eventTileViewModel={eventTileViewModel} mxEvent={mxEvent} />
            )}
        </div>
    );
}
