/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, renderHook, waitFor } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import {
    Room,
    RoomStateEvent,
    type MatrixEvent,
    MatrixEventEvent,
    type MatrixClient,
    EventType,
    RoomEvent,
    type IRoomTimelineData,
    type ISendEventResponse,
    type IContent,
} from "matrix-js-sdk/src/matrix";
import { Widget } from "matrix-widget-api";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";
import { randomUUID } from "node:crypto";

import {
    useMockedCalls,
    MockedCall,
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    mkEvent,
    clientAndSDKContextRenderOptions,
} from "../../test-utils";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { CallStore } from "../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import ToastStore from "../../../src/stores/ToastStore";
import { getNotificationEventSendTs, useIncomingCallToast } from "../../../src/hooks/useIncomingCallToast";
import { AudioID } from "../../../src/LegacyCallHandler";
import { CallEvent } from "../../../src/models/Call";
import { type WidgetMessaging } from "../../../src/stores/widgets/WidgetMessaging";
import { TestSDKContext } from "../TestSDKContext.ts";

function makeNotificationEvent(room: Room, content: IContent = {}): MatrixEvent {
    const ts = Date.now();
    const notificationContent = {
        "notification_type": "notification",
        "m.relation": { rel_type: "m.reference", event_id: "$memberEventId" },
        "m.mentions": { user_ids: [], room: true },
        "lifetime": 3000,
        "sender_ts": ts,
        ...content,
    } as unknown as IRTCNotificationContent;
    return mkEvent({
        type: EventType.RTCNotification,
        user: "@userId:matrix.org",
        content: notificationContent,
        room: room.roomId,
        ts,
        id: "$notificationEventId",
        event: true,
    });
}

describe("useIncomingCallToast", () => {
    useMockedCalls();

    let client: Mocked<MatrixClient>;
    let sdkContext: TestSDKContext;
    let room: Room;

    let call: MockedCall;
    let widget: Widget;
    const dmRoomMap = {
        getUserIdForRoomId: jest.fn(),
    } as unknown as DMRoomMap;
    const toastStore = {
        dismissToast: jest.fn(),
    } as unknown as Mocked<ToastStore>;

    beforeEach(async () => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        sdkContext = new TestSDKContext();
        sdkContext._client = client;

        const audio = document.createElement("audio");
        audio.id = AudioID.Ring;
        document.body.appendChild(audio);

        room = new Room("!1:example.org", client, "@alice:example.org");
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
        } as unknown as WidgetMessaging);

        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        jest.spyOn(ToastStore, "sharedInstance").mockReturnValue(toastStore);
        toastStore.dismissToast.mockReset();
    });

    afterEach(async () => {
        call.destroy();
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        jest.restoreAllMocks();
    });

    const renderHookForToast = (notificationEvent: MatrixEvent = makeNotificationEvent(room)) => {
        const toastKey = randomUUID();
        return renderHook(
            () => useIncomingCallToast(notificationEvent, toastKey),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
    };

    it("starts ringing for a ring notification", () => {
        const notificationEvent = makeNotificationEvent(room, { notification_type: "ring" });
        const playMock = jest.spyOn(sdkContext.legacyCallHandler, "play");
        renderHookForToast(notificationEvent);
        expect(playMock).toHaveBeenCalledWith(AudioID.Ring);
    });

    it("does not ring for a plain notification", () => {
        const playMock = jest.spyOn(sdkContext.legacyCallHandler, "play");
        renderHookForToast();
        expect(playMock).not.toHaveBeenCalled();
    });

    it("stops ringing on unmount", () => {
        const pauseMock = jest.spyOn(sdkContext.legacyCallHandler, "pause");
        const notificationEvent = makeNotificationEvent(room, { notification_type: "ring" });
        const { unmount } = renderHookForToast(notificationEvent);
        unmount();
        expect(pauseMock).toHaveBeenCalledWith(AudioID.Ring);
    });

    it("dismisses and dispatches on join, skipping the lobby", async () => {
        const { result } = renderHookForToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        act(() => {
            result.current.onJoin();
        });

        expect(toastStore.dismissToast).toHaveBeenCalled();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: Action.ViewRoom, room_id: room.roomId, skipLobby: true }),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("dispatches without dismissing on expand, showing the lobby", async () => {
        const { result } = renderHookForToast();

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        act(() => {
            result.current.onExpand();
        });

        expect(toastStore.dismissToast).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: Action.ViewRoom, room_id: room.roomId, skipLobby: false }),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("dismisses once the call lobby is viewed", async () => {
        renderHookForToast();

        defaultDispatcher.dispatch({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
        });

        await waitFor(() => expect(toastStore.dismissToast).toHaveBeenCalled());
    });

    it("dismisses when the call event is redacted", async () => {
        renderHookForToast();

        const event = room.currentState.getStateEvents(MockedCall.EVENT_TYPE, "1")!;
        act(() => {
            room.emit(MatrixEventEvent.BeforeRedaction, event, {} as unknown as MatrixEvent);
        });

        await waitFor(() => expect(toastStore.dismissToast).toHaveBeenCalled());
    });

    it("dismisses when the matrixRTC session has ended", async () => {
        renderHookForToast();

        act(() => {
            call.destroy();
        });

        await waitFor(() => expect(toastStore.dismissToast).toHaveBeenCalled());
    });

    it("dismisses when a decline event for this notification was received", async () => {
        const notificationEvent = makeNotificationEvent(room);
        renderHookForToast(notificationEvent);

        act(() => {
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
        });

        await waitFor(() => expect(toastStore.dismissToast).toHaveBeenCalled());
    });

    it("does not dismiss for a decline event from another user", async () => {
        const notificationEvent = makeNotificationEvent(room);
        renderHookForToast(notificationEvent);

        act(() => {
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
        });

        expect(toastStore.dismissToast).not.toHaveBeenCalled();
    });

    it("dismisses when another of our devices joins the call", async () => {
        renderHookForToast();

        act(() => {
            call.emit(
                CallEvent.Participants,
                new Map([[mkRoomMember(room.roomId, "@userId:matrix.org"), new Set(["a"])]]),
                new Map(),
            );
        });

        await waitFor(() => expect(toastStore.dismissToast).toHaveBeenCalled());
    });

    it("sends a decline event and only dismisses after it resolves", async () => {
        const { result } = renderHookForToast();

        const { promise, resolve } = Promise.withResolvers<ISendEventResponse>();
        client.sendRtcDecline.mockImplementation(() => promise);

        let onDeclinePromise!: Promise<void>;
        act(() => {
            onDeclinePromise = result.current.onDecline({ stopPropagation: () => {} } as any);
        });

        expect(toastStore.dismissToast).not.toHaveBeenCalled();
        expect(client.sendRtcDecline).toHaveBeenCalledWith("!1:example.org", "$notificationEventId");

        resolve({ event_id: "$declineEventId" });
        await act(() => onDeclinePromise);

        expect(toastStore.dismissToast).toHaveBeenCalled();
    });

    it("getNotificationEventSendTs returns the correct ts", () => {
        const notificationEvent = makeNotificationEvent(room);
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
