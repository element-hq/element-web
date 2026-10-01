/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "test-utils-rtl";
import {
    Room,
    RoomStateEvent,
    type MatrixClient,
    PendingEventOrdering,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { Widget } from "matrix-widget-api";

import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    wrapInMatrixClientContext,
    useMockMediaDevices,
    flushPromisesWithFakeTimers,
} from "test-utils";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { CallEvent as UnwrappedCallEvent } from "./CallEvent";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { CallStore } from "../../../stores/CallStore";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { ConnectionState } from "../../../models/Call";
import { type WidgetMessaging } from "../../../stores/widgets/WidgetMessaging";

const CallEvent = wrapInMatrixClientContext(UnwrappedCallEvent);

describe("CallEvent", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let call: MockedCall;
    let widget: Widget;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);

        useMockMediaDevices();
        useMockedCalls();
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

        stubClient();
        client = vi.mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");
        vi.spyOn(room, "getMember").mockImplementation(
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
        } as unknown as WidgetMessaging);
    });

    afterEach(async () => {
        cleanup(); // Unmount before we do any cleanup that might update the component
        call.destroy();
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    const renderEvent = () => {
        render(<CallEvent mxEvent={call.event} />);
    };

    it("shows a message and duration if the call was ended", () => {
        vi.advanceTimersByTime(90000);
        call.destroy();
        renderEvent();

        expect(screen.getByText("Video call ended")).toBeVisible();
        expect(screen.getByText("1m 30s")).toBeVisible();
    });

    it("shows a message if the call was redacted", () => {
        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        vi.spyOn(event, "isRedacted").mockReturnValue(true);
        renderEvent();

        expect(screen.getByText("Video call ended")).toBeVisible();
    });

    it("shows placeholder info if the call isn't loaded yet", () => {
        vi.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
        vi.advanceTimersByTime(90000);
        renderEvent();

        screen.getByText("@alice:example.org started a video call");
        expect(screen.getByRole("button", { name: "Join" })).toHaveAttribute("aria-disabled", "true");
    });

    it("shows call details and connection controls if the call is loaded", async () => {
        vi.advanceTimersByTime(90000);
        call.participants = new Map([
            [alice, new Set(["a"])],
            [bob, new Set(["b"])],
        ]);
        renderEvent();

        screen.getByText("@alice:example.org started a video call");
        screen.getByLabelText("2 people joined");

        // Test that the join button works
        const dispatcherSpy = vi.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
        fireEvent.click(screen.getByRole("button", { name: "Join" }));
        await flushPromisesWithFakeTimers();
        expect(dispatcherSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
        });
        defaultDispatcher.unregister(dispatcherRef);
        act(() => call.setConnectionState(ConnectionState.Connected));

        // Test that the leave button works
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Leave" }));
            await flushPromisesWithFakeTimers();
        });
        screen.getByRole("button", { name: "Join" });
        expect(call.connectionState).toBe(ConnectionState.Disconnected);
    });
});
