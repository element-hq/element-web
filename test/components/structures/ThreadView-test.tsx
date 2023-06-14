/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

import { act, getByTestId, render, RenderResult, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { MsgType, RelationType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";
import React, { useState } from "react";

import ThreadView from "../../../src/components/structures/ThreadView";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../src/contexts/RoomContext";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { Action } from "../../../src/dispatcher/actions";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { mockPlatformPeg } from "../../test-utils/platform";
import { getRoomContext } from "../../test-utils/room";
import { stubClient } from "../../test-utils/test-utils";
import { mkThread } from "../../test-utils/threads";

describe("ThreadView", () => {
    const ROOM_ID = "!roomId:example.org";
    const SENDER = "@alice:example.org";

    let mockClient: MatrixClient;
    let room: Room;
    let rootEvent: MatrixEvent;

    let changeEvent: (event: MatrixEvent) => void;

    function TestThreadView({ initialEvent }: { initialEvent?: MatrixEvent }) {
        const [event, setEvent] = useState(rootEvent);
        changeEvent = setEvent;

        return (
            <MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider
                    value={getRoomContext(room, {
                        canSendMessages: true,
                    })}
                >
                    <ThreadView
                        room={room}
                        onClose={jest.fn()}
                        mxEvent={event}
                        initialEvent={initialEvent}
                        resizeNotifier={new ResizeNotifier()}
                    />
                </RoomContext.Provider>
                ,
            </MatrixClientContext.Provider>
        );
    }

    async function getComponent(initialEvent?: MatrixEvent): Promise<RenderResult> {
        const renderResult = render(<TestThreadView initialEvent={initialEvent} />);

        await waitFor(() => {
            expect(() => getByTestId(renderResult.container, "spinner")).toThrow();
        });

        return renderResult;
    }

    async function sendMessage(container: HTMLElement, text: string): Promise<void> {
        const composer = getByTestId(container, "basicmessagecomposer");
        await userEvent.click(composer);
        await userEvent.keyboard(text);
        const sendMessageBtn = getByTestId(container, "sendmessagebtn");
        await userEvent.click(sendMessageBtn);
    }

    function expectedMessageBody(rootEvent: MatrixEvent, message: string) {
        return {
            "body": message,
            "m.relates_to": {
                "event_id": rootEvent.getId(),
                "is_falling_back": true,
                "m.in_reply_to": {
                    event_id: rootEvent
                        .getThread()!
                        .lastReply((ev: MatrixEvent) => {
                            return ev.isRelation(THREAD_RELATION_TYPE.name);
                        })!
                        .getId(),
                },
                "rel_type": RelationType.Thread,
            },
            "msgtype": MsgType.Text,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        mockPlatformPeg();
        mockClient = mocked(MatrixClientPeg.safeGet());
        jest.spyOn(mockClient, "supportsThreads").mockReturnValue(true);

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const res = mkThread({
            room,
            client: mockClient,
            authorId: mockClient.getUserId()!,
            participantUserIds: [mockClient.getUserId()!],
        });

        rootEvent = res.rootEvent;

        DMRoomMap.makeShared(mockClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(SENDER);
    });

    it("sends a message with the correct fallback", async () => {
        const { container } = await getComponent();

        await sendMessage(container, "Hello world!");

        expect(mockClient.sendMessage).toHaveBeenCalledWith(
            ROOM_ID,
            rootEvent.getId(),
            expectedMessageBody(rootEvent, "Hello world!"),
        );
    });

    it("sends a thread message with the correct fallback", async () => {
        const { container } = await getComponent();

        const { rootEvent: rootEvent2 } = mkThread({
            room,
            client: mockClient,
            authorId: mockClient.getUserId()!,
            participantUserIds: [mockClient.getUserId()!],
        });

        act(() => {
            changeEvent(rootEvent2);
        });

        await sendMessage(container, "yolo");

        expect(mockClient.sendMessage).toHaveBeenCalledWith(
            ROOM_ID,
            rootEvent2.getId(),
            expectedMessageBody(rootEvent2, "yolo"),
        );
    });

    it("sets the correct thread in the room view store", async () => {
        // expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBeNull();
        const { unmount } = await getComponent();
        expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBe(rootEvent.getId());

        unmount();
        await waitFor(() => expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBeNull());
    });

    it("clears highlight message in the room view store", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(room.roomId);
        const mock = jest.spyOn(dispatcher, "dispatch");
        const { unmount } = await getComponent(rootEvent);
        mock.mockClear();
        unmount();
        expect(mock).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: undefined,
        });
    });
});
