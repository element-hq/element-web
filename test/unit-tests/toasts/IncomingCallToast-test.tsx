/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import {
    Room,
    RoomStateEvent,
    type MatrixEvent,
    MatrixEventEvent,
    type MatrixClient,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { type ClientWidgetApi, Widget } from "matrix-widget-api";
import { type ICallNotifyContent } from "matrix-js-sdk/src/matrixrtc";

import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
} from "../../test-utils";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { CallStore } from "../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import ToastStore from "../../../src/stores/ToastStore";
import { getIncomingCallToastKey, IncomingCallToast } from "../../../src/toasts/IncomingCallToast";
import LegacyCallHandler, { AudioID } from "../../../src/LegacyCallHandler";

describe("IncomingCallToast", () => {
    useMockedCalls();

    let client: Mocked<MatrixClient>;
    let room: Room;
    let notifyContent: ICallNotifyContent;
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

        const audio = document.createElement("audio");
        audio.id = AudioID.Ring;
        document.body.appendChild(audio);

        room = new Room("!1:example.org", client, "@alice:example.org");
        notifyContent = {
            call_id: "",
            getRoomId: () => room.roomId,
        } as unknown as ICallNotifyContent;
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);
        MockedCall.create(room, "1");

        await Promise.all(
            [CallStore.instance, WidgetMessagingStore.instance].map((store) =>
                setupAsyncStoreWithClient(store, client),
            ),
        );

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
        call.event.getContent = () => notifyContent as any;
        render(<IncomingCallToast notifyEvent={call.event} />);
    };

    it("correctly shows all the information", () => {
        call.participants = new Map([
            [alice, new Set("a")],
            [bob, new Set(["b1", "b2"])],
        ]);
        renderToast();

        screen.getByText("Video call started");
        screen.getByText("Video");
        screen.getByLabelText("3 people joined");

        screen.getByRole("button", { name: "Join" });
        screen.getByRole("button", { name: "Close" });
    });

    it("start ringing on ring notify event", () => {
        call.event.getContent = () =>
            ({
                ...notifyContent,
                notify_type: "ring",
            }) as any;

        const playMock = jest.spyOn(LegacyCallHandler.instance, "play");
        render(<IncomingCallToast notifyEvent={call.event} />);
        expect(playMock).toHaveBeenCalled();
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
                skipLobby: false,
                view_call: true,
            }),
        );
        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });
    it("Dismiss toast if user starts call and skips lobby when using shift key click", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        fireEvent.click(screen.getByRole("button", { name: "Join" }), { shiftKey: true });
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                skipLobby: true,
                view_call: true,
            }),
        );
        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("closes the toast", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
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
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
        );
    });

    it("closes toast when the call event is redacted", async () => {
        renderToast();

        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        event.emit(MatrixEventEvent.BeforeRedaction, event, {} as unknown as MatrixEvent);

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
        );
    });

    it("closes toast when the matrixRTC session has ended", async () => {
        renderToast();
        call.destroy();

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notifyContent.call_id, room.roomId),
            ),
        );
    });
});
