/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";

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
