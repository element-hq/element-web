/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, getByTestId, render, type RenderResult, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import {
    MsgType,
    RelationType,
    EventStatus,
    type MatrixEvent,
    Room,
    type MatrixClient,
    PendingEventOrdering,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import React, { useState } from "react";

import ThreadView from "../../../../src/components/structures/ThreadView";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { Action } from "../../../../src/dispatcher/actions";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { mockPlatformPeg } from "../../../test-utils/platform";
import { getRoomContext } from "../../../test-utils/room";
import { mkMessage, stubClient } from "../../../test-utils/test-utils";
import { mkThread } from "../../../test-utils/threads";
import { ScopedRoomContextProvider } from "../../../../src/contexts/ScopedRoomContext.tsx";

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
                <ScopedRoomContextProvider
                    {...getRoomContext(room, {
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
                </ScopedRoomContextProvider>
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
            "m.mentions": {},
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

    it("does not include pending root event in the timeline twice", async () => {
        rootEvent = mkMessage({
            user: mockClient.getUserId()!,
            event: true,
            room: room.roomId,
            msg: "root event message " + Math.random(),
        });

        rootEvent.status = EventStatus.SENDING;
        rootEvent.setTxnId("1234");
        room.addPendingEvent(rootEvent, "1234");
        room.updatePendingEvent(rootEvent, EventStatus.SENT, rootEvent.getId());

        const { container } = await getComponent();
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(1);
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
        waitFor(() => {
            expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBe(rootEvent.getId());
        });

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
