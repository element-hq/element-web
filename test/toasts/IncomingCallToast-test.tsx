/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { ClientWidgetApi, Widget } from "matrix-widget-api";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/models/event";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
} from "../test-utils";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { CallStore } from "../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import DMRoomMap from "../../src/utils/DMRoomMap";
import ToastStore from "../../src/stores/ToastStore";
import { getIncomingCallToastKey, IncomingCallToast } from "../../src/toasts/IncomingCallToast";

describe("IncomingCallEvent", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let call: MockedCall;
    let widget: Widget;
    const dmRoomMap = {
        getUserIdForRoomId: jest.fn(),
    } as unknown as DMRoomMap;
    const toastStore = {
        dismissToast: jest.fn(),
    } as unknown as ToastStore;

    beforeEach(async () => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        room = new Room("!1:example.org", client, "@alice:example.org");

        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");

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

        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        jest.spyOn(ToastStore, "sharedInstance").mockReturnValue(toastStore);
    });

    afterEach(async () => {
        cleanup(); // Unmount before we do any cleanup that might update the component
        call.destroy();
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        jest.restoreAllMocks();
    });

    const renderToast = () => {
        render(<IncomingCallToast callEvent={call.event} />);
    };

    it("correctly shows all the information", () => {
        call.participants = new Map([
            [alice, new Set("a")],
            [bob, new Set(["b1", "b2"])],
        ]);
        renderToast();

        screen.getByText("Video call started");
        screen.getByText("Video");
        screen.getByLabelText("3 participants");

        screen.getByRole("button", { name: "Join" });
        screen.getByRole("button", { name: "Close" });
    });

    it("correctly renders toast without a call", () => {
        call.destroy();
        renderToast();

        screen.getByText("Video call started");
        screen.getByText("Video");

        screen.getByRole("button", { name: "Join" });
        screen.getByRole("button", { name: "Close" });
    });

    it("joins the call and closes the toast", async () => {
        renderToast();

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
        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(getIncomingCallToastKey(call.event.getStateKey()!)),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("closes the toast", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(getIncomingCallToastKey(call.event.getStateKey()!)),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("closes toast when the call lobby is viewed", async () => {
        renderToast();

        defaultDispatcher.dispatch({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
        });

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(getIncomingCallToastKey(call.event.getStateKey()!)),
        );
    });

    it("closes toast when the call event is redacted", async () => {
        renderToast();

        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        event.emit(MatrixEventEvent.BeforeRedaction, event, {} as unknown as MatrixEvent);

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(getIncomingCallToastKey(call.event.getStateKey()!)),
        );
    });
});
