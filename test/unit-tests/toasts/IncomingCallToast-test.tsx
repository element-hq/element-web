/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "jest-matrix-react";
import { type Mock, mocked, type Mocked } from "jest-mock";
import {
    Room,
    RoomStateEvent,
    type MatrixEvent,
    MatrixEventEvent,
    type MatrixClient,
    type RoomMember,
    EventType,
    RoomEvent,
    type IRoomTimelineData,
    type ISendEventResponse,
} from "matrix-js-sdk/src/matrix";
import { type ClientWidgetApi, Widget } from "matrix-widget-api";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    mkEvent,
} from "../../test-utils";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { CallStore } from "../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import ToastStore from "../../../src/stores/ToastStore";
import {
    getIncomingCallToastKey,
    getNotificationEventSendTs,
    IncomingCallToast,
} from "../../../src/toasts/IncomingCallToast";
import LegacyCallHandler, { AudioID } from "../../../src/LegacyCallHandler";
import { CallEvent } from "../../../src/models/Call";

describe("IncomingCallToast", () => {
    useMockedCalls();

    let client: Mocked<MatrixClient>;
    let room: Room;
    let notificationEvent: MatrixEvent;

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
        const ts = Date.now();
        const notificationContent = {
            "notification_type": "notification",
            "m.relation": { rel_type: "m.reference", event_id: "$memberEventId" },
            "m.mentions": { user_ids: [], room: true },
            "lifetime": 3000,
            "sender_ts": ts,
        } as unknown as IRTCNotificationContent;
        notificationEvent = mkEvent({
            type: EventType.RTCNotification,
            user: "@userId:matrix.org",
            content: notificationContent,
            room: room.roomId,
            ts,
            id: "$notificationEventId",
            event: true,
        });
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
        call.event.getContent = () =>
            ({
                call_id: "",
                getRoomId: () => room.roomId,
            }) as any;
        render(<IncomingCallToast notificationEvent={notificationEvent} />);
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
        const oldContent = notificationEvent.getContent() as IRTCNotificationContent;
        (notificationEvent as unknown as { getContent: () => IRTCNotificationContent }).getContent = () => {
            return { ...oldContent, notification_type: "ring" } as IRTCNotificationContent;
        };

        const playMock = jest.spyOn(LegacyCallHandler.instance, "play");
        render(<IncomingCallToast notificationEvent={notificationEvent} />);
        expect(playMock).toHaveBeenCalled();
    });

    it("correctly renders toast without a call", () => {
        call.destroy();
        renderToast();

        screen.getByText("Video call started");
        screen.getByText("Video");

        screen.getByRole("button", { name: "Join" });
        screen.getByRole("button", { name: "Decline" });
        screen.getByRole("button", { name: "Close" });
    });

    it("opens the call directly and closes the toast when pressing on the join button", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        // click on the avatar (which is the example used for pressing on any area other than the buttons)
        fireEvent.click(screen.getByRole("button", { name: "Join" }));
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
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("opens the call lobby and closes the toast when configured like that", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        fireEvent.click(screen.getByRole("switch", {}));

        // click on the avatar (which is the example used for pressing on any area other than the buttons)
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
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
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
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("Dismiss toast if user joins with a remote device", async () => {
        renderToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        call.emit(
            CallEvent.Participants,
            new Map([[mkRoomMember(room.roomId, "@userId:matrix.org"), new Set(["a"])]]),
            new Map(),
        );

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
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
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
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
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("closes toast when the call event is redacted", async () => {
        renderToast();

        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        event.emit(MatrixEventEvent.BeforeRedaction, event, {} as unknown as MatrixEvent);

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("closes toast when the matrixRTC session has ended", async () => {
        renderToast();
        call.destroy();

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("closes toast when a decline event was received", async () => {
        (toastStore.dismissToast as Mock).mockReset();
        renderToast();

        room.emit(
            RoomEvent.Timeline,
            mkEvent({
                user: "@userId:matrix.org",
                type: EventType.RTCDecline,
                content: { "m.relates_to": { event_id: notificationEvent.getId()!, rel_type: "m.reference" } },
                event: true,
            }),
            room,
            undefined,
            false,
            {} as unknown as IRoomTimelineData,
        );

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("does not close toast when a decline event for another user was received", async () => {
        (toastStore.dismissToast as Mock).mockReset();
        renderToast();

        room.emit(
            RoomEvent.Timeline,
            mkEvent({
                user: "@userIdNotMe:matrix.org",
                type: EventType.RTCDecline,
                content: { "m.relates_to": { event_id: notificationEvent.getId()!, rel_type: "m.reference" } },
                event: true,
            }),
            room,
            undefined,
            false,
            {} as unknown as IRoomTimelineData,
        );

        await waitFor(() =>
            expect(toastStore.dismissToast).not.toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("does not close toast when a decline event for another notification Event was received", async () => {
        (toastStore.dismissToast as Mock).mockReset();
        renderToast();

        room.emit(
            RoomEvent.Timeline,
            mkEvent({
                user: "@userId:matrix.org",
                type: EventType.RTCDecline,
                content: { "m.relates_to": { event_id: "$otherNotificationEventRelation", rel_type: "m.reference" } },
                event: true,
            }),
            room,
            undefined,
            false,
            {} as unknown as IRoomTimelineData,
        );

        await waitFor(() =>
            expect(toastStore.dismissToast).not.toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("sends a decline event when clicking the decline button and only dismiss after sending", async () => {
        (toastStore.dismissToast as Mock).mockReset();

        renderToast();

        const { promise, resolve } = Promise.withResolvers<ISendEventResponse>();
        client.sendRtcDecline.mockImplementation(() => {
            return promise;
        });

        fireEvent.click(screen.getByRole("button", { name: "Decline" }));

        expect(toastStore.dismissToast).not.toHaveBeenCalledWith(
            getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
        );
        expect(client.sendRtcDecline).toHaveBeenCalledWith("!1:example.org", "$notificationEventId");

        resolve({ event_id: "$declineEventId" });

        await waitFor(() =>
            expect(toastStore.dismissToast).toHaveBeenCalledWith(
                getIncomingCallToastKey(notificationEvent.getId()!, room.roomId),
            ),
        );
    });

    it("getNotificationEventSendTs returns the correct ts", () => {
        const eventOriginServerTs = mkEvent({
            user: "@userId:matrix.org",
            type: EventType.RTCNotification,
            content: {
                "m.relates_to": { event_id: notificationEvent.getId()!, rel_type: "m.reference" },
                "sender_ts": 222_000,
            },
            event: true,
            ts: 1111,
        });

        const eventSendTs = mkEvent({
            user: "@userId:matrix.org",
            type: EventType.RTCNotification,
            content: {
                "m.relates_to": { event_id: notificationEvent.getId()!, rel_type: "m.reference" },
                "sender_ts": 2222,
            },
            event: true,
            ts: 1111,
        });

        expect(getNotificationEventSendTs(eventOriginServerTs)).toBe(1111);
        expect(getNotificationEventSendTs(eventSendTs)).toBe(2222);
    });
});
