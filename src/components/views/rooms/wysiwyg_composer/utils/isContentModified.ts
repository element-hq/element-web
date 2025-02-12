/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMessageEventContent, type RoomMessageTextEventContent } from "matrix-js-sdk/src/types";

import type EditorStateTransfer from "../../../../../utils/EditorStateTransfer";

export function isContentModified(
    newContent: RoomMessageEventContent,
    editorStateTransfer: EditorStateTransfer,
): boolean {
    // if nothing has changed then bail
    const oldContent = editorStateTransfer.getEvent().getContent<RoomMessageEventContent>();
    if (
        oldContent["msgtype"] === newContent["msgtype"] &&
        oldContent["body"] === newContent["body"] &&
        (<RoomMessageTextEventContent>oldContent)["format"] === (<RoomMessageTextEventContent>newContent)["format"] &&
        (<RoomMessageTextEventContent>oldContent)["formatted_body"] ===
            (<RoomMessageTextEventContent>newContent)["formatted_body"]
    ) {
        return false;
    }
    return true;
}
