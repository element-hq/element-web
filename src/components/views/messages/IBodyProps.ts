/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { LegacyRef } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { GetRelationsForEvent } from "../rooms/EventTile";

export interface IBodyProps {
    mxEvent: MatrixEvent;

    /* a list of words to highlight */
    highlights?: string[];

    /* link URL for the highlights */
    highlightLink?: string;

    /* callback called when dynamic content in events are loaded */
    onHeightChanged?: () => void;

    showUrlPreview?: boolean;
    forExport?: boolean;
    maxImageHeight?: number;
    replacingEventId?: string;
    editState?: EditorStateTransfer;
    onMessageAllowed?: () => void; // TODO: Docs
    permalinkCreator?: RoomPermalinkCreator;
    mediaEventHelper?: MediaEventHelper;

    /*
    If present and `true`, the message has been marked as hidden pending moderation
    (see MSC3531) **but** the current user can see the message nevertheless (with
    a marker), either because they are a moderator or because they are the original
    author of the message.
    */
    isSeeingThroughMessageHiddenForModeration?: boolean;

    // helper function to access relations for this event
    getRelationsForEvent?: GetRelationsForEvent;

    ref?: React.RefObject<any> | LegacyRef<any>;

    // Set to `true` to disable interactions (e.g. video controls) and to remove controls from the tab order.
    // This may be useful when displaying a preview of the event.
    inhibitInteraction?: boolean;
}
