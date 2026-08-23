/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { act, getByTestId, render, type RenderResult, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
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
import { mockPlatformPeg, getRoomContext, mkMessage, stubClient, untilDispatch } from "test-utils";
import { mkThread } from "test-utils/threads";

import ThreadView from "./ThreadView";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { SDKContextClass } from "../../contexts/SDKContextClass";
import { Action } from "../../dispatcher/actions";
import dispatcher from "../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import DMRoomMap from "../../utils/DMRoomMap";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext.tsx";
import { TimelineRenderingType } from "../../contexts/RoomContext.ts";
import { type ComposerInsertPayload, ComposerType } from "../../dispatcher/payloads/ComposerInsertPayload.ts";
import { SDKContext } from "../../contexts/SDKContext.ts";
import RightPanelStore from "../../stores/right-panel/RightPanelStore.ts";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases.ts";

describe("ThreadView", () => {
    const ROOM_ID = "!roomId:example.org";
    const SENDER = "@alice:example.org";

    let mockClient: MatrixClient;
    let room: Room;
    let rootEvent: MatrixEvent;

    let changeEvent: (event: MatrixEvent) => void;
    let changeRoom: (room: Room) => void;

    function TestThreadView({ initialEvent, fullSize = false }: { initialEvent?: MatrixEvent; fullSize?: boolean }) {
        const [event, setEvent] = useState(rootEvent);
        const [currentRoom, setCurrentRoom] = useState(room);
        changeEvent = setEvent;
        changeRoom = setCurrentRoom;

        return (
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider
                    {...getRoomContext(currentRoom, {
                        canSendMessages: true,
                    })}
                >
                    <ThreadView
                        room={currentRoom}
                        onClose={vi.fn()}
                        mxEvent={event}
                        initialEvent={initialEvent}
                        resizeNotifier={new ResizeNotifier()}
                        fullSize={fullSize}
                    />
                </ScopedRoomContextProvider>
                ,
            </MatrixClientContext.Provider>
        );
    }

    async function getComponent(initialEvent?: MatrixEvent, fullSize = false): Promise<RenderResult> {
        const renderResult = render(<TestThreadView initialEvent={initialEvent} fullSize={fullSize} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
            ),
        });

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
        vi.clearAllMocks();
        RightPanelStore.instance.reset();

        stubClient();
        mockPlatformPeg();
        mockClient = vi.mocked(MatrixClientPeg.safeGet());
        vi.spyOn(mockClient, "supportsThreads").mockReturnValue(true);

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
        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(SENDER);
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

    it.each([
        { fullSize: false, presentation: "right-panel" },
        { fullSize: true, presentation: "full-size" },
    ])("sets the correct thread in the room view store in the $presentation presentation", async ({ fullSize }) => {
        const { unmount } = await getComponent(undefined, fullSize);
        await waitFor(() => {
            expect(SDKContextClass.instance.roomViewStore.getThreadId()).toBe(rootEvent.getId());
        });

        unmount();
        await waitFor(() => expect(SDKContextClass.instance.roomViewStore.getThreadId()).toBeNull());
    });

    it("renders the right-panel card presentation", async () => {
        RightPanelStore.instance.setCards([
            { phase: RightPanelPhases.ThreadPanel },
            { phase: RightPanelPhases.ThreadView, state: { threadHeadEvent: rootEvent } },
        ]);

        const { container } = await getComponent();
        const threadView = container.querySelector(".mx_ThreadView");
        const composer = getByTestId(container, "basicmessagecomposer").closest(".mx_MessageComposer");

        expect(threadView).toBeInTheDocument();
        expect(getByTestId(container, "base-card-close-button")).toBeInTheDocument();
        expect(getByTestId(container, "base-card-back-button")).toBeInTheDocument();
        expect(getByTestId(container, "threadlist-dropdown-button")).toBeInTheDocument();
        expect(composer).toHaveClass("mx_MessageComposer--compact");
    });

    it("renders the full-size presentation without right-panel card controls", async () => {
        const { container } = await getComponent(undefined, true);
        const threadView = container.querySelector(".mx_ThreadView");
        const composer = getByTestId(container, "basicmessagecomposer").closest(".mx_MessageComposer");

        expect(threadView).toBeInTheDocument();
        expect(threadView).toHaveClass("mx_ThreadView_fullSize");
        expect(container.querySelector('[data-testid="base-card-close-button"]')).not.toBeInTheDocument();
        expect(container.querySelector('[data-testid="base-card-back-button"]')).not.toBeInTheDocument();
        expect(container.querySelector('[data-testid="threadlist-dropdown-button"]')).not.toBeInTheDocument();
        expect(composer).toBeInTheDocument();
        expect(composer).not.toHaveClass("mx_MessageComposer--compact");
    });

    it("does not replace the right-panel card when the room changes in full-size presentation", async () => {
        const setCard = vi.spyOn(RightPanelStore.instance, "setCard");
        await getComponent(undefined, true);
        setCard.mockClear();
        const nextRoom = new Room("!next-room:example.org", mockClient, mockClient.getUserId() ?? "");

        act(() => changeRoom(nextRoom));

        expect(setCard).not.toHaveBeenCalled();
    });

    it("clears highlight message in the room view store", async () => {
        vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(room.roomId);
        const mock = vi.spyOn(dispatcher, "dispatch");
        const { unmount } = await getComponent(rootEvent);
        mock.mockClear();
        unmount();
        expect(mock).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: undefined,
        });
    });

    describe("handles Action.ComposerInsert", () => {
        it("redispatches a payload of timelineRenderingType=Thread", async () => {
            await getComponent();
            const promise = untilDispatch((payload) => {
                try {
                    expect(payload).toEqual({
                        action: Action.ComposerInsert,
                        text: "Hello world",
                        timelineRenderingType: TimelineRenderingType.Thread,
                        composerType: ComposerType.Send,
                    });
                } catch {
                    return false;
                }
                return true;
            }, dispatcher);
            dispatcher.dispatch({
                action: Action.ComposerInsert,
                text: "Hello world",
                timelineRenderingType: TimelineRenderingType.Thread,
            } satisfies ComposerInsertPayload);
            await promise;
        });
        it("ignores payloads with a composerType", async () => {
            await getComponent();
            const promise = untilDispatch(
                (payload) => {
                    try {
                        expect(payload).toStrictEqual({
                            action: Action.ComposerInsert,
                            text: "Hello world",
                            timelineRenderingType: TimelineRenderingType.Thread,
                            composerType: ComposerType.Send,
                        });
                    } catch {
                        return false;
                    }
                    return true;
                },
                dispatcher,
                500,
            );
            dispatcher.dispatch({
                action: Action.ComposerInsert,
                text: "Hello world",
                composerType: ComposerType.Send,
                timelineRenderingType: TimelineRenderingType.Thread,
                // Ensure we don't accidentally pick up this emit by strictly checking above.
                viaTest: true,
            } satisfies ComposerInsertPayload);
            await expect(promise).rejects.toThrow();
        });
        it("ignores payloads with a timelineRenderingType != TimelineRenderingType.Thread", async () => {
            await getComponent();
            const promise = untilDispatch(
                (payload) => {
                    try {
                        expect(payload).toStrictEqual({
                            action: Action.ComposerInsert,
                            text: "Hello world",
                            timelineRenderingType: TimelineRenderingType.Thread,
                            composerType: ComposerType.Send,
                        });
                    } catch {
                        return false;
                    }
                    return true;
                },
                dispatcher,
                500,
            );
            dispatcher.dispatch({
                action: Action.ComposerInsert,
                text: "Hello world",
                composerType: ComposerType.Send,
                timelineRenderingType: TimelineRenderingType.Room,
                // Ensure we don't accidentally pick up this emit by strictly checking above.
                viaTest: true,
            } satisfies ComposerInsertPayload);
            await expect(promise).rejects.toThrow();
        });
    });
});
