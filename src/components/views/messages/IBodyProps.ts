/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { LegacyRef } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

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
    onMessageAllowed: () => void; // TODO: Docs
    permalinkCreator?: RoomPermalinkCreator;
    mediaEventHelper: MediaEventHelper;

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
