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

import { EventTimeline, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { getRoomContext, mkEvent, mkStubRoom, stubClient } from "../../../../test-utils";
import { IRoomState } from "../../../../../src/components/structures/RoomView";
import EditorStateTransfer from "../../../../../src/utils/EditorStateTransfer";

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
