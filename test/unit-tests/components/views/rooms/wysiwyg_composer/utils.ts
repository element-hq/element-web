/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventTimeline, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { getRoomContext, mkEvent, mkStubRoom, stubClient } from "../../../../../test-utils";
import { type IRoomState } from "../../../../../../src/components/structures/RoomView";
import EditorStateTransfer from "../../../../../../src/utils/EditorStateTransfer";

export function createMocks(eventContent = "Replying <strong>to</strong> this new content") {
    const mockClient = stubClient();
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: "myfakeroom",
        user: "myfakeuser",
        content: {
            msgtype: "m.text",
            body: "Replying to this",
            format: "org.matrix.custom.html",
            formatted_body: eventContent,
        },
        event: true,
    });
    const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
    mockRoom.findEventById = jest.fn((eventId) => {
        return eventId === mockEvent.getId() ? mockEvent : null;
    });

    const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {
        liveTimeline: { getEvents: (): MatrixEvent[] => [] } as unknown as EventTimeline,
    });

    const editorStateTransfer = new EditorStateTransfer(mockEvent);

    return { defaultRoomContext, editorStateTransfer, mockClient, mockEvent };
}
