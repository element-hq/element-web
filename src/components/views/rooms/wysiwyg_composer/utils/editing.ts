/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, MatrixClient } from "matrix-js-sdk/src/matrix";

import { IRoomState } from "../../../../structures/RoomView";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";

export function endEditing(roomContext: IRoomState): void {
    // todo local storage
    // localStorage.removeItem(this.editorRoomKey);
    // localStorage.removeItem(this.editorStateKey);

    // close the event editing and focus composer
    dis.dispatch({
        action: Action.EditEvent,
        event: null,
        timelineRenderingType: roomContext.timelineRenderingType,
    });
    dis.dispatch({
        action: Action.FocusSendMessageComposer,
        context: roomContext.timelineRenderingType,
    });
}

export function cancelPreviousPendingEdit(mxClient: MatrixClient, editorStateTransfer: EditorStateTransfer): void {
    const originalEvent = editorStateTransfer.getEvent();
    const previousEdit = originalEvent.replacingEvent();
    if (previousEdit && (previousEdit.status === EventStatus.QUEUED || previousEdit.status === EventStatus.NOT_SENT)) {
        mxClient.cancelPendingEvent(previousEdit);
    }
}
