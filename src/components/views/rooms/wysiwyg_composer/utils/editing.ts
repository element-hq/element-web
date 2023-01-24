/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
