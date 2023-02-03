/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";

import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { IRoomState } from "../../../../structures/RoomView";
import { ComposerContextState } from "../ComposerContext";

// From EditMessageComposer private get events(): MatrixEvent[]
export function getEventsFromEditorStateTransfer(
    editorStateTransfer: EditorStateTransfer,
    roomContext: IRoomState,
    mxClient: MatrixClient,
): MatrixEvent[] | undefined {
    const liveTimelineEvents = roomContext.liveTimeline?.getEvents();
    if (!liveTimelineEvents) {
        return;
    }

    const roomId = editorStateTransfer.getEvent().getRoomId();
    if (!roomId) {
        return;
    }

    const room = mxClient.getRoom(roomId);
    if (!room) {
        return;
    }

    const pendingEvents = room.getPendingEvents();
    const isInThread = Boolean(editorStateTransfer.getEvent().getThread());
    return liveTimelineEvents.concat(isInThread ? [] : pendingEvents);
}

// From SendMessageComposer private onKeyDown = (event: KeyboardEvent): void
export function getEventsFromRoom(
    composerContext: ComposerContextState,
    roomContext: IRoomState,
): MatrixEvent[] | undefined {
    const isReplyingToThread = composerContext.eventRelation?.key === THREAD_RELATION_TYPE.name;
    return roomContext.liveTimeline
        ?.getEvents()
        .concat(isReplyingToThread ? [] : roomContext.room?.getPendingEvents() || []);
}
