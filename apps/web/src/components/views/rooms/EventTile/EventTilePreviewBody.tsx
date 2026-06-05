/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { EventPreviewView } from "@element-hq/web-shared-components";

import { DecryptionFailureBodyFactory, RedactedBodyFactory } from "../../messages/MBodyFactory";
import { type EventPreviewViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventPreviewViewModel";

export type EventTilePreviewBodyKind = "redacted" | "decryptionFailure" | "preview";

interface EventTilePreviewBodyProps {
    previewKind: EventTilePreviewBodyKind;
    mxEvent: MatrixEvent;
    eventPreviewVm?: EventPreviewViewModel;
}

/** Renders the compact body preview used by notification and thread-list tiles. */
export function EventTilePreviewBody({
    previewKind,
    mxEvent,
    eventPreviewVm,
}: Readonly<EventTilePreviewBodyProps>): JSX.Element {
    let body: JSX.Element;

    switch (previewKind) {
        case "redacted":
            body = <RedactedBodyFactory mxEvent={mxEvent} />;
            break;
        case "decryptionFailure":
            body = <DecryptionFailureBodyFactory mxEvent={mxEvent} />;
            break;
        case "preview":
            body = <EventPreviewView vm={eventPreviewVm!} />;
            break;
    }

    return <div className="mx_EventTile_body">{body}</div>;
}
