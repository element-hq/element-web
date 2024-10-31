/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { TimelineRenderingType } from "../../contexts/RoomContext";

export interface FocusComposerPayload extends ActionPayload {
    action:
        | Action.FocusAComposer
        | Action.FocusEditMessageComposer
        | Action.FocusSendMessageComposer
        | "reply_to_event";

    context?: TimelineRenderingType; // defaults to Room type for backwards compatibility
}
