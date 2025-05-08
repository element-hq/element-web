/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act, cleanup, fireEvent, waitFor } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import {
    Room,
    RoomStateEvent,
    type MatrixClient,
    PendingEventOrdering,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { type ClientWidgetApi, Widget } from "matrix-widget-api";

import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    wrapInMatrixClientContext,
    useMockMediaDevices,
} from "../../../../test-utils";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { CallEvent as UnwrappedCallEvent } from "../../../../../src/components/views/messages/CallEvent";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { CallStore } from "../../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../../src/stores/widgets/WidgetMessagingStore";
import { ConnectionState } from "../../../../../src/models/Call";

const CallEvent = wrapInMatrixClientContext(UnwrappedCallEvent);

describe("CallEvent", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let call: MockedCall;
    let widget: Widget;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);

        useMockMediaDevices();
        useMockedCalls();
        jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");
        jest.spyOn(room, "getMember").mockImplementation(
            (userId) => [alice, bob].find((member) => member.userId === userId) ?? null,
        );

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        await Promise.all(
            [CallStore.instance, WidgetMessagingStore.instance].map((store) =>
                setupAsyncStoreWithClient(store, client),
            ),
        );

        MockedCall.create(room, "1");
        const maybeCall = CallStore.instance.getCall(room.roomId);
        if (!(maybeCall instanceof MockedCall)) throw new Error("Failed to create call");
        call = maybeCall;

        widget = new Widget(call.widget);
        WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
            stop: () => {},
        } as unknown as ClientWidgetApi);
    });

    afterEach(async () => {
        cleanup(); // Unmount before we do any cleanup that might update the component
        call.destroy();
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        jest.restoreAllMocks();
    });

    const renderEvent = () => {
        render(<CallEvent mxEvent={call.event} />);
    };

    it("shows a message and duration if the call was ended", () => {
        jest.advanceTimersByTime(90000);
        call.destroy();
        renderEvent();

        screen.getByText("Video call ended");
        screen.getByText("1m 30s");
    });

    it("shows a message if the call was redacted", () => {
        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        jest.spyOn(event, "isRedacted").mockReturnValue(true);
        renderEvent();

        screen.getByText("Video call ended");
    });

    it("shows placeholder info if the call isn't loaded yet", () => {
        jest.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
        jest.advanceTimersByTime(90000);
        renderEvent();

        screen.getByText("@alice:example.org started a video call");
        expect(screen.getByRole("button", { name: "Join" })).toHaveAttribute("aria-disabled", "true");
    });

    it("shows call details and connection controls if the call is loaded", async () => {
        jest.advanceTimersByTime(90000);
        call.participants = new Map([
            [alice, new Set(["a"])],
            [bob, new Set(["b"])],
        ]);
        renderEvent();

        screen.getByText("@alice:example.org started a video call");
        screen.getByLabelText("2 people joined");

        // Test that the join button works
        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
        fireEvent.click(screen.getByRole("button", { name: "Join" }));
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
            }),
        );
        defaultDispatcher.unregister(dispatcherRef);
        await act(() => call.start());

        // Test that the leave button works
        fireEvent.click(screen.getByRole("button", { name: "Leave" }));
        await waitFor(() => screen.getByRole("button", { name: "Join" }));
        expect(call.connectionState).toBe(ConnectionState.Disconnected);
    });
});
