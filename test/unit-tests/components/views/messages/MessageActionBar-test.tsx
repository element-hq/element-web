/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, fireEvent, screen, waitFor } from "jest-matrix-react";
import {
    EventType,
    EventStatus,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    Room,
    FeatureSupport,
    Thread,
    EventTimeline,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";

import MessageActionBar from "../../../../../src/components/views/messages/MessageActionBar";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsEvents,
    makeBeaconInfoEvent,
} from "../../../../test-utils";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import RoomContext, { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { Action } from "../../../../../src/dispatcher/actions";
import PinningUtils from "../../../../../src/utils/PinningUtils";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../src/dispatcher/dispatcher");

describe("<MessageActionBar />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        getRoom: jest.fn(),
        setRoomAccountData: jest.fn(),
        sendStateEvent: jest.fn(),
    });
    const room = new Room(roomId, client, userId);

    const alicesMessageEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        room_id: roomId,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
        event_id: "$alices_message",
    });

    const bobsMessageEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: "@bob:server.org",
        room_id: roomId,
        content: {
            msgtype: MsgType.Text,
            body: "I am bob",
        },
        event_id: "$bobs_message",
    });

    const redactedEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
    });
    redactedEvent.makeRedacted(redactedEvent, room);

    const localStorageMock = (() => {
        let store: Record<string, any> = {};
        return {
            getItem: jest.fn().mockImplementation((key) => store[key] ?? null),
            setItem: jest.fn().mockImplementation((key, value) => {
                store[key] = value;
            }),
            clear: jest.fn().mockImplementation(() => {
                store = {};
            }),
            removeItem: jest.fn().mockImplementation((key) => delete store[key]),
        };
    })();
    Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        writable: true,
    });

    jest.spyOn(room, "getPendingEvents").mockReturnValue([]);

    client.getRoom.mockReturnValue(room);

    const defaultProps = {
        getTile: jest.fn(),
        getReplyChain: jest.fn(),
        toggleThreadExpanded: jest.fn(),
        mxEvent: alicesMessageEvent,
        permalinkCreator: new RoomPermalinkCreator(room),
    };
    const defaultRoomContext = {
        ...RoomContext,
        timelineRenderingType: TimelineRenderingType.Room,
        canSendMessages: true,
        canReact: true,
        room,
    } as unknown as IRoomState;
    const getComponent = (props = {}, roomContext: Partial<IRoomState> = {}) =>
        render(
            <ScopedRoomContextProvider {...defaultRoomContext} {...roomContext}>
                <MessageActionBar {...defaultProps} {...props} />
            </ScopedRoomContextProvider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
        alicesMessageEvent.setStatus(EventStatus.SENT);
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    afterAll(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(SettingsStore, "setValue").mockRestore();
    });

    it("kills event listeners on unmount", () => {
        const offSpy = jest.spyOn(alicesMessageEvent, "off").mockClear();
        const wrapper = getComponent({ mxEvent: alicesMessageEvent });

        act(() => {
            wrapper.unmount();
        });

        expect(offSpy.mock.calls[0][0]).toEqual(MatrixEventEvent.Status);
        expect(offSpy.mock.calls[1][0]).toEqual(MatrixEventEvent.Decrypted);
        expect(offSpy.mock.calls[2][0]).toEqual(MatrixEventEvent.BeforeRedaction);

        expect(client.decryptEventIfNeeded).toHaveBeenCalled();
    });

    describe("decryption", () => {
        it("decrypts event if needed", () => {
            getComponent({ mxEvent: alicesMessageEvent });
            expect(client.decryptEventIfNeeded).toHaveBeenCalled();
        });

        it("updates component on decrypted event", () => {
            const decryptingEvent = new MatrixEvent({
                type: EventType.RoomMessageEncrypted,
                sender: userId,
                room_id: roomId,
                content: {},
            });
            jest.spyOn(decryptingEvent, "isBeingDecrypted").mockReturnValue(true);
            const { queryByLabelText } = getComponent({ mxEvent: decryptingEvent });

            // still encrypted event is not actionable => no reply button
            expect(queryByLabelText("Reply")).toBeFalsy();

            act(() => {
                // ''decrypt'' the event
                decryptingEvent.event.type = alicesMessageEvent.getType();
                decryptingEvent.event.content = alicesMessageEvent.getContent();
                decryptingEvent.emit(MatrixEventEvent.Decrypted, decryptingEvent);
            });

            // new available actions after decryption
            expect(queryByLabelText("Reply")).toBeTruthy();
        });
    });

    describe("status", () => {
        it("updates component when event status changes", () => {
            alicesMessageEvent.setStatus(EventStatus.QUEUED);
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });

            // pending event status, cancel action available
            expect(queryByLabelText("Delete")).toBeTruthy();

            act(() => {
                alicesMessageEvent.setStatus(EventStatus.SENT);
            });

            // event is sent, no longer cancelable
            expect(queryByLabelText("Delete")).toBeFalsy();
        });
    });

    describe("redaction", () => {
        // this doesn't do what it's supposed to
        // because beforeRedaction event is fired... before redaction
        // event is unchanged at point when this component updates
        // TODO file bug
        it.skip("updates component on before redaction event", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                sender: userId,
                room_id: roomId,
                content: {
                    msgtype: MsgType.Text,
                    body: "Hello",
                },
            });
            const { queryByLabelText } = getComponent({ mxEvent: event });

            // no pending redaction => no delete button
            expect(queryByLabelText("Delete")).toBeFalsy();

            act(() => {
                const redactionEvent = new MatrixEvent({
                    type: EventType.RoomRedaction,
                    sender: userId,
                    room_id: roomId,
                });
                redactionEvent.setStatus(EventStatus.QUEUED);
                event.markLocallyRedacted(redactionEvent);
            });

            // updated with local redaction event, delete now available
            expect(queryByLabelText("Delete")).toBeTruthy();
        });
    });

    describe("options button", () => {
        it("renders options menu", () => {
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Options")).toBeTruthy();
        });

        it("opens message context menu on click", () => {
            const { getByTestId, queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            fireEvent.click(queryByLabelText("Options")!);
            expect(getByTestId("mx_MessageContextMenu")).toBeTruthy();
        });
    });

    describe("reply button", () => {
        it("renders reply button on own actionable event", () => {
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Reply")).toBeTruthy();
        });

        it("renders reply button on others actionable event", () => {
            const { queryByLabelText } = getComponent({ mxEvent: bobsMessageEvent }, { canSendMessages: true });
            expect(queryByLabelText("Reply")).toBeTruthy();
        });

        it("does not render reply button on non-actionable event", () => {
            // redacted event is not actionable
            const { queryByLabelText } = getComponent({ mxEvent: redactedEvent });
            expect(queryByLabelText("Reply")).toBeFalsy();
        });

        it("does not render reply button when user cannot send messaged", () => {
            // redacted event is not actionable
            const { queryByLabelText } = getComponent({ mxEvent: redactedEvent }, { canSendMessages: false });
            expect(queryByLabelText("Reply")).toBeFalsy();
        });

        it("dispatches reply event on click", () => {
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });

            fireEvent.click(queryByLabelText("Reply")!);

            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: alicesMessageEvent,
                context: TimelineRenderingType.Room,
            });
        });
    });

    describe("react button", () => {
        it("renders react button on own actionable event", () => {
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("React")).toBeTruthy();
        });

        it("renders react button on others actionable event", () => {
            const { queryByLabelText } = getComponent({ mxEvent: bobsMessageEvent });
            expect(queryByLabelText("React")).toBeTruthy();
        });

        it("does not render react button on non-actionable event", () => {
            // redacted event is not actionable
            const { queryByLabelText } = getComponent({ mxEvent: redactedEvent });
            expect(queryByLabelText("React")).toBeFalsy();
        });

        it("does not render react button when user cannot react", () => {
            // redacted event is not actionable
            const { queryByLabelText } = getComponent({ mxEvent: redactedEvent }, { canReact: false });
            expect(queryByLabelText("React")).toBeFalsy();
        });

        it("opens reaction picker on click", () => {
            const { queryByLabelText, getByTestId } = getComponent({ mxEvent: alicesMessageEvent });
            fireEvent.click(queryByLabelText("React")!);
            expect(getByTestId("mx_EmojiPicker")).toBeTruthy();
        });
    });

    describe("cancel button", () => {
        it("renders cancel button for an event with a cancelable status", () => {
            alicesMessageEvent.setStatus(EventStatus.QUEUED);
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Delete")).toBeTruthy();
        });

        it("renders cancel button for an event with a pending edit", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                sender: userId,
                room_id: roomId,
                content: {
                    msgtype: MsgType.Text,
                    body: "Hello",
                },
            });
            event.setStatus(EventStatus.SENT);
            const replacingEvent = new MatrixEvent({
                type: EventType.RoomMessage,
                sender: userId,
                room_id: roomId,
                content: {
                    msgtype: MsgType.Text,
                    body: "replacing event body",
                },
            });
            replacingEvent.setStatus(EventStatus.QUEUED);
            event.makeReplaced(replacingEvent);
            const { queryByLabelText } = getComponent({ mxEvent: event });
            expect(queryByLabelText("Delete")).toBeTruthy();
        });

        it("renders cancel button for an event with a pending redaction", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                sender: userId,
                room_id: roomId,
                content: {
                    msgtype: MsgType.Text,
                    body: "Hello",
                },
            });
            event.setStatus(EventStatus.SENT);

            const redactionEvent = new MatrixEvent({
                type: EventType.RoomRedaction,
                sender: userId,
                room_id: roomId,
            });
            redactionEvent.setStatus(EventStatus.QUEUED);

            event.markLocallyRedacted(redactionEvent);
            const { queryByLabelText } = getComponent({ mxEvent: event });
            expect(queryByLabelText("Delete")).toBeTruthy();
        });

        it("renders cancel and retry button for an event with NOT_SENT status", () => {
            alicesMessageEvent.setStatus(EventStatus.NOT_SENT);
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Retry")).toBeTruthy();
            expect(queryByLabelText("Delete")).toBeTruthy();
        });

        it.todo("unsends event on cancel click");
        it.todo("retrys event on retry click");
    });

    describe("thread button", () => {
        beforeEach(() => {
            Thread.setServerSideSupport(FeatureSupport.Stable);
        });

        describe("when threads feature is enabled", () => {
            it("renders thread button on own actionable event", () => {
                const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
                expect(queryByLabelText("Reply in thread")).toBeTruthy();
            });

            it("does not render thread button for a beacon_info event", () => {
                const beaconInfoEvent = makeBeaconInfoEvent(userId, roomId);
                const { queryByLabelText } = getComponent({ mxEvent: beaconInfoEvent });
                expect(queryByLabelText("Reply in thread")).toBeFalsy();
            });

            it("opens thread on click", () => {
                const { getByLabelText } = getComponent({ mxEvent: alicesMessageEvent });

                fireEvent.click(getByLabelText("Reply in thread"));

                expect(dispatcher.dispatch).toHaveBeenCalledWith({
                    action: Action.ShowThread,
                    rootEvent: alicesMessageEvent,
                    push: false,
                });
            });

            it("opens parent thread for a thread reply message", () => {
                const threadReplyEvent = new MatrixEvent({
                    type: EventType.RoomMessage,
                    sender: userId,
                    room_id: roomId,
                    content: {
                        msgtype: MsgType.Text,
                        body: "this is a thread reply",
                    },
                });
                // mock the thread stuff
                jest.spyOn(threadReplyEvent, "isThreadRoot", "get").mockReturnValue(false);
                // set alicesMessageEvent as the root event
                jest.spyOn(threadReplyEvent, "getThread").mockReturnValue({
                    rootEvent: alicesMessageEvent,
                } as unknown as Thread);
                const { getByLabelText } = getComponent({ mxEvent: threadReplyEvent });

                fireEvent.click(getByLabelText("Reply in thread"));

                expect(dispatcher.dispatch).toHaveBeenCalledWith({
                    action: Action.ShowThread,
                    rootEvent: alicesMessageEvent,
                    initialEvent: threadReplyEvent,
                    highlighted: true,
                    scroll_into_view: true,
                    push: false,
                });
            });
        });
    });

    it.each([["React"], ["Reply"], ["Reply in thread"], ["Edit"], ["Pin"]])(
        "does not show context menu when right-clicking",
        (buttonLabel: string) => {
            // For favourite and pin buttons
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

            const event = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
            });
            event.stopPropagation = jest.fn();
            event.preventDefault = jest.fn();

            const { queryByTestId, queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            fireEvent(queryByLabelText(buttonLabel)!, event);
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(event.preventDefault).toHaveBeenCalled();
            expect(queryByTestId("mx_MessageContextMenu")).toBeFalsy();
        },
    );

    it("does shows context menu when right-clicking options", () => {
        const { queryByTestId, queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
        fireEvent.contextMenu(queryByLabelText("Options")!);
        expect(queryByTestId("mx_MessageContextMenu")).toBeTruthy();
    });

    describe("pin button", () => {
        beforeEach(() => {
            // enable pin button
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(false);
        });

        afterEach(() => {
            jest.spyOn(
                room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockRestore();
        });

        it("should not render pin button when user can't send state event", () => {
            jest.spyOn(
                room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(false);

            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Pin")).toBeFalsy();
        });

        it("should render pin button", () => {
            const { queryByLabelText } = getComponent({ mxEvent: alicesMessageEvent });
            expect(queryByLabelText("Pin")).toBeTruthy();
        });

        it("should listen to room pinned events", async () => {
            getComponent({ mxEvent: alicesMessageEvent });
            expect(screen.getByLabelText("Pin")).toBeInTheDocument();

            // Event is considered pinned
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            // Emit that the room pinned events have changed
            const roomState = room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;
            roomState.emit(
                RoomStateEvent.Events,
                {
                    getType: () => EventType.RoomPinnedEvents,
                } as MatrixEvent,
                roomState,
                null,
            );

            await waitFor(() => expect(screen.getByLabelText("Unpin")).toBeInTheDocument());
        });
    });
});
