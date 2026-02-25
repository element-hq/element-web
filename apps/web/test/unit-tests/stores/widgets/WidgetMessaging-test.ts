/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type MockedFunction, type MockedObject } from "jest-mock";
import { findLast, last } from "lodash";
import {
    MatrixEvent,
    type MatrixClient,
    ClientEvent,
    type EventTimeline,
    EventType,
    MatrixEventEvent,
    RoomStateEvent,
    type RoomState,
    type Room,
} from "matrix-js-sdk/src/matrix";
import {
    ClientWidgetApi,
    type IModalWidgetOpenRequest,
    type IStickerActionRequest,
    type IStickyActionRequest,
    type IWidgetApiRequest,
    MatrixCapabilities,
    WidgetApiDirection,
    WidgetApiFromWidgetAction,
} from "matrix-widget-api";
import { waitFor } from "jest-matrix-react";

import { stubClient, mkRoom, mkEvent } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { ElementWidget, WidgetMessaging } from "../../../../src/stores/widgets/WidgetMessaging";
import ActiveWidgetStore from "../../../../src/stores/ActiveWidgetStore";
import SettingsStore from "../../../../src/settings/SettingsStore";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { UPDATE_EVENT } from "../../../../src/stores/AsyncStore";
import { type IApp } from "../../../../src/utils/WidgetUtils-types";
import { ModalWidgetStore } from "../../../../src/stores/ModalWidgetStore";
import { ElementWidgetActions, type IViewRoomApiRequest } from "../../../../src/stores/widgets/ElementWidgetActions";
import { ElementWidgetCapabilities } from "../../../../src/stores/widgets/ElementWidgetCapabilities";
import { WidgetType } from "../../../../src/widgets/WidgetType";
import { IntegrationManagers } from "../../../../src/integrations/IntegrationManagers";
import { type IntegrationManagerInstance } from "../../../../src/integrations/IntegrationManagerInstance";

jest.mock("matrix-widget-api", () => ({
    ...jest.requireActual("matrix-widget-api"),
    ClientWidgetApi: (jest.createMockFromModule("matrix-widget-api") as any).ClientWidgetApi,
}));

const originGetValue = SettingsStore.getValue;

describe("WidgetMessaging", () => {
    let client: MockedObject<MatrixClient>;
    let widget: WidgetMessaging;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        const app: IApp = {
            id: "test",
            creatorUserId: "@alice:example.org",
            type: "example",
            url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
            roomId: "!1:example.org",
        };
        widget = new WidgetMessaging(new ElementWidget(app), {
            app,
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.start(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
        messaging.feedStateUpdate.mockResolvedValue();
    });

    afterEach(() => {
        widget.stop();
    });

    it("should replace parameters in widget url template", () => {
        const spy = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "theme") return "my-theme-for-testing";
            return originGetValue(setting);
        });
        expect(widget.embedUrl).toBe(
            "https://example.org/?user-id=%40userId%3Amatrix.org&device-id=ABCDEFGHI&base-url=https%3A%2F%2Fmatrix-client.matrix.org&theme=my-theme-for-testing&widgetId=test&parentUrl=http%3A%2F%2Flocalhost%2F",
        );
        spy.mockClear();
    });

    it("should replace parameters in widget url template for popout", () => {
        const spy = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "theme") return "my-theme-for-testing";
            return originGetValue(setting);
        });
        expect(widget.popoutUrl).toBe(
            "https://example.org/?user-id=%40userId%3Amatrix.org&device-id=ABCDEFGHI&base-url=https%3A%2F%2Fmatrix-client.matrix.org&theme=my-theme-for-testing",
        );
        spy.mockClear();
    });

    it("feeds incoming to-device messages to the widget", async () => {
        const receivedToDevice = {
            message: {
                type: "org.example.foo",
                sender: "@alice:example.org",
                content: {
                    hello: "world",
                },
            },
            encryptionInfo: null,
        };

        client.emit(ClientEvent.ReceivedToDeviceMessage, receivedToDevice);
        await Promise.resolve(); // flush promises
        expect(messaging.feedToDevice).toHaveBeenCalledWith(receivedToDevice.message, false);
    });

    it("feeds incoming encrypted to-device messages to the widget", async () => {
        const receivedToDevice = {
            message: {
                type: "org.example.foo",
                sender: "@alice:example.org",
                content: {
                    hello: "world",
                },
            },
            encryptionInfo: {
                senderVerified: false,
                sender: "@alice:example.org",
                senderCurve25519KeyBase64: "",
                senderDevice: "ABCDEFGHI",
            },
        };

        client.emit(ClientEvent.ReceivedToDeviceMessage, receivedToDevice);
        await Promise.resolve(); // flush promises
        expect(messaging.feedToDevice).toHaveBeenCalledWith(receivedToDevice.message, true);
    });

    it("feeds incoming state updates to the widget", () => {
        const event = mkEvent({
            event: true,
            type: "org.example.foo",
            skey: "",
            user: "@alice:example.org",
            content: { hello: "world" },
            room: "!1:example.org",
        });

        client.emit(RoomStateEvent.Events, event, {} as unknown as RoomState, null);
        expect(messaging.feedStateUpdate).toHaveBeenCalledWith(event.getEffectiveEvent());
    });

    it("informs widget of theme changes", () => {
        let theme = "light";
        const settingsSpy = jest
            .spyOn(SettingsStore, "getValue")
            .mockImplementation((name) => (name === "theme" ? theme : null));
        try {
            // Indicate that the widget is ready
            findLast(messaging.once.mock.calls, ([eventName]) => eventName === "ready")![1]();

            // Now change the theme
            theme = "dark";
            defaultDispatcher.dispatch({ action: Action.RecheckTheme }, true);
            expect(messaging.updateTheme).toHaveBeenLastCalledWith({ name: "dark" });
        } finally {
            settingsSpy.mockRestore();
        }
    });

    describe("feed event", () => {
        let event1: MatrixEvent;
        let event2: MatrixEvent;

        beforeEach(() => {
            event1 = mkEvent({
                event: true,
                id: "$event-id1",
                type: "org.example.foo",
                user: "@alice:example.org",
                content: { hello: "world" },
                room: "!1:example.org",
            });

            event2 = mkEvent({
                event: true,
                id: "$event-id2",
                type: "org.example.foo",
                user: "@alice:example.org",
                content: { hello: "world" },
                room: "!1:example.org",
            });

            const room = mkRoom(client, "!1:example.org");
            client.getRoom.mockImplementation((roomId) => (roomId === "!1:example.org" ? room : null));
            room.getLiveTimeline.mockReturnValue({
                getEvents: (): MatrixEvent[] => [event1, event2],
            } as unknown as EventTimeline);

            messaging.feedEvent.mockResolvedValue();
        });

        it("feeds incoming event to the widget", async () => {
            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent());

            client.emit(ClientEvent.Event, event2);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent());
        });

        it("should not feed incoming event to the widget if seen already", async () => {
            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent());

            client.emit(ClientEvent.Event, event2);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent());

            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent());
        });

        it("feeds decrypted events asynchronously", async () => {
            const event1Encrypted = new MatrixEvent({
                event_id: event1.getId(),
                type: EventType.RoomMessageEncrypted,
                sender: event1.sender?.userId,
                room_id: event1.getRoomId(),
                content: {},
            });
            const decryptingSpy1 = jest.spyOn(event1Encrypted, "isBeingDecrypted").mockReturnValue(true);
            client.emit(ClientEvent.Event, event1Encrypted);
            const event2Encrypted = new MatrixEvent({
                event_id: event2.getId(),
                type: EventType.RoomMessageEncrypted,
                sender: event2.sender?.userId,
                room_id: event2.getRoomId(),
                content: {},
            });
            const decryptingSpy2 = jest.spyOn(event2Encrypted, "isBeingDecrypted").mockReturnValue(true);
            client.emit(ClientEvent.Event, event2Encrypted);
            expect(messaging.feedEvent).not.toHaveBeenCalled();

            // "Decrypt" the events, but in reverse order; first event 2…
            event2Encrypted.event.type = event2.getType();
            event2Encrypted.event.content = event2.getContent();
            decryptingSpy2.mockReturnValue(false);
            client.emit(MatrixEventEvent.Decrypted, event2Encrypted);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(1);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2Encrypted.getEffectiveEvent());
            // …then event 1
            event1Encrypted.event.type = event1.getType();
            event1Encrypted.event.content = event1.getContent();
            decryptingSpy1.mockReturnValue(false);
            client.emit(MatrixEventEvent.Decrypted, event1Encrypted);
            // The events should be fed in that same order so that event 2
            // doesn't have to be blocked on the decryption of event 1 (or
            // worse, dropped)
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event1Encrypted.getEffectiveEvent());
        });

        it("should not feed incoming event if not in timeline", () => {
            const event = mkEvent({
                event: true,
                id: "$event-id",
                type: "org.example.foo",
                user: "@alice:example.org",
                content: {
                    hello: "world",
                },
                room: "!1:example.org",
            });

            client.emit(ClientEvent.Event, event);
            expect(messaging.feedEvent).toHaveBeenCalledWith(event.getEffectiveEvent());
        });

        it("feeds incoming event that is not in timeline but relates to unknown parent to the widget", async () => {
            const event = mkEvent({
                event: true,
                id: "$event-idRelation",
                type: "org.example.foo",
                user: "@alice:example.org",
                content: {
                    "hello": "world",
                    "m.relates_to": {
                        event_id: "$unknown-parent",
                        rel_type: "m.reference",
                    },
                },
                room: "!1:example.org",
            });

            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent());

            client.emit(ClientEvent.Event, event);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event.getEffectiveEvent());

            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event.getEffectiveEvent());
        });
    });
});

describe("WidgetMessaging with stickyPromise", () => {
    let client: MockedObject<MatrixClient>;
    let widget: WidgetMessaging;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
    });

    afterEach(() => {
        widget.stop();
    });
    it("should wait for the sticky promise to resolve before starting messaging", async () => {
        jest.useFakeTimers();
        const getStickyPromise = async () => {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        };
        const app: IApp = {
            id: "test",
            creatorUserId: "@alice:example.org",
            type: "example",
            url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url",
            roomId: "!1:example.org",
        };
        widget = new WidgetMessaging(new ElementWidget(app), {
            app,
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
            stickyPromise: getStickyPromise,
        });

        const setPersistenceSpy = jest.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence");

        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.start(null as unknown as HTMLIFrameElement);
        const emitSticky = async () => {
            messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
            messaging?.hasCapability.mockReturnValue(true);
            // messaging.transport.reply will be called but transport is undefined in this test environment
            // This just makes sure the call doesn't throw
            Object.defineProperty(messaging, "transport", { value: { reply: () => {} } });
            messaging.on.mock.calls.find(([event, listener]) => {
                if (event === `action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`) {
                    listener({ preventDefault: () => {}, detail: { data: { value: true } } });
                    return true;
                }
            });
        };
        await emitSticky();
        expect(setPersistenceSpy).not.toHaveBeenCalled();
        // Advance the fake timer so that the sticky promise resolves
        jest.runAllTimers();
        // Use a real timer and wait for the next tick so the sticky promise can resolve
        jest.useRealTimers();

        waitFor(() => expect(setPersistenceSpy).toHaveBeenCalled(), { interval: 5 });
    });
});

describe("WidgetMessaging as an account widget", () => {
    let widget: WidgetMessaging;
    let messaging: MockedObject<ClientWidgetApi>;
    let getRoomId: MockedFunction<() => string | null>;

    beforeEach(() => {
        stubClient();
        // I give up, getting the return type of spyOn right is hopeless
        getRoomId = jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId") as unknown as MockedFunction<
            () => string | null
        >;
        getRoomId.mockReturnValue("!1:example.org");

        const app: IApp = {
            id: "test",
            creatorUserId: "@alice:example.org",
            type: "example",
            url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
            roomId: "!1:example.org",
        };
        widget = new WidgetMessaging(new ElementWidget(app), {
            app,
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.start(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
    });

    afterEach(() => {
        widget.stop();
        getRoomId.mockRestore();
    });

    it("updates viewed room", () => {
        expect(messaging.setViewedRoomId).toHaveBeenCalledTimes(1);
        expect(messaging.setViewedRoomId).toHaveBeenLastCalledWith("!1:example.org");
        getRoomId.mockReturnValue("!2:example.org");
        SdkContextClass.instance.roomViewStore.emit(UPDATE_EVENT);
        expect(messaging.setViewedRoomId).toHaveBeenCalledTimes(2);
        expect(messaging.setViewedRoomId).toHaveBeenLastCalledWith("!2:example.org");
    });
});

function createTransportEvent<T extends IWidgetApiRequest>(data: T["data"]): CustomEvent<T> {
    // Not the complete CustomEvent but good nuff.
    return {
        preventDefault: () => {},
        detail: {
            action: WidgetApiFromWidgetAction.OpenModalWidget,
            data: data,
            api: WidgetApiDirection.FromWidget,
            requestId: "12345",
            widgetId: "test",
        },
    } as unknown as CustomEvent;
}

describe("WidgetMessaging action handling", () => {
    let widget: WidgetMessaging;
    let messaging: MockedObject<ClientWidgetApi>;
    let actionFns: Record<string, (ev: any) => void>;

    beforeEach(() => {
        const client = stubClient();

        const app: IApp = {
            id: "test",
            creatorUserId: "@alice:example.org",
            type: "example",
            url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
            roomId: "!1:example.org",
        };
        widget = new WidgetMessaging(new ElementWidget(app), {
            app,
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.start(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
        Object.defineProperty(messaging, "transport", { value: { reply: jest.fn() } });
        actionFns = Object.fromEntries(messaging.on.mock.calls as any);
    });

    afterEach(() => {
        widget.stop();
        jest.resetAllMocks();
    });

    describe("open modal widget", () => {
        beforeEach(() => {
            // Trivial mock of ModalWidgetStore
            let hasModal = false;
            jest.spyOn(ModalWidgetStore.instance, "openModalWidget").mockImplementation(() => {
                if (hasModal) {
                    throw Error("Modal already in view");
                }
                hasModal = true;
            });
            jest.spyOn(ModalWidgetStore.instance, "canOpenModalWidget").mockImplementation(() => !hasModal);
            jest.spyOn(ModalWidgetStore.instance, "closeModalWidget").mockImplementation(() => {
                if (!hasModal) {
                    throw Error("No modal in view");
                }
                hasModal = false;
            });
        });

        it("handles an open modal request", () => {
            const ev = createTransportEvent<IModalWidgetOpenRequest>({ type: "foo", url: "bar" });
            actionFns[`action:${WidgetApiFromWidgetAction.OpenModalWidget}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
        });

        it("responds with an error if a modal is already open", () => {
            const ev = createTransportEvent<IModalWidgetOpenRequest>({ type: "foo", url: "bar" });
            actionFns[`action:${WidgetApiFromWidgetAction.OpenModalWidget}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
            messaging.transport.reply.mockReset();
            actionFns[`action:${WidgetApiFromWidgetAction.OpenModalWidget}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {
                error: { message: "Unable to open modal at this time" },
            });
        });
    });

    describe("view room", () => {
        afterEach(() => {
            jest.resetAllMocks();
        });
        it("errors on invalid room", () => {
            const ev = createTransportEvent<IViewRoomApiRequest>({ room_id: null } as any);
            actionFns[`action:${ElementWidgetActions.ViewRoom}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {
                error: { message: "Room ID not supplied." },
            });
        });
        it("errors on missing permissions", () => {
            const ev = createTransportEvent<IViewRoomApiRequest>({ room_id: "!foo:example.org" } as any);
            actionFns[`action:${ElementWidgetActions.ViewRoom}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {
                error: { message: "This widget does not have permission for this action (denied)." },
            });
        });
        it("handles room change", async () => {
            const ev = createTransportEvent<IViewRoomApiRequest>({ room_id: "!foo:example.org" } as any);
            messaging.hasCapability.mockImplementation(
                (capability) => capability === ElementWidgetCapabilities.CanChangeViewedRoom,
            );
            const dispatch = (defaultDispatcher.dispatch = jest.fn());
            actionFns[`action:${ElementWidgetActions.ViewRoom}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
            expect(dispatch).toHaveBeenCalledWith({
                action: "view_room",
                metricsTrigger: "Widget",
                room_id: "!foo:example.org",
            });
        });
    });

    describe("always on screen", () => {
        let setWidgetPersistence: jest.SpyInstance<void, Parameters<ActiveWidgetStore["setWidgetPersistence"]>>;
        beforeEach(() => {
            setWidgetPersistence = jest.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence");
        });

        it("does nothing if the widget does not have permission", () => {
            const ev = createTransportEvent<IStickyActionRequest>({ value: true });
            actionFns[`action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`](ev);
            // Currently there is no error response for this.
            expect(messaging.transport.reply).not.toHaveBeenCalled();
        });

        it("handles setting a widget as sticky", () => {
            messaging.hasCapability.mockImplementation(
                (capability) => capability === MatrixCapabilities.AlwaysOnScreen,
            );
            const ev = createTransportEvent<IStickyActionRequest>({ value: true });
            actionFns[`action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
            expect(setWidgetPersistence).toHaveBeenCalledTimes(1);
        });

        it("handles setting a widget as unsticky", () => {
            messaging.hasCapability.mockImplementation(
                (capability) => capability === MatrixCapabilities.AlwaysOnScreen,
            );
            const evOpen = createTransportEvent<IStickyActionRequest>({ value: true });
            actionFns[`action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`](evOpen);
            expect(messaging.transport.reply).toHaveBeenCalledWith(evOpen.detail, {});
            expect(setWidgetPersistence).toHaveBeenCalledTimes(1);
            messaging.transport.reply.mockReset();
            const evClose = createTransportEvent<IStickyActionRequest>({ value: false });
            actionFns[`action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`](evClose);
            expect(messaging.transport.reply).toHaveBeenCalledWith(evClose.detail, {});
            expect(setWidgetPersistence).toHaveBeenCalledTimes(2);
        });
    });

    describe("send sticker", () => {
        it("does nothing if the widget does not have permission", () => {
            const ev = createTransportEvent<IStickerActionRequest>({ name: "foo", content: { url: "bar" } });
            actionFns[`action:${WidgetApiFromWidgetAction.SendSticker}`](ev);
            // Currently there is no error response for this.
            expect(messaging.transport.reply).not.toHaveBeenCalled();
        });

        it("handles setting a widget as sticky", () => {
            messaging.hasCapability.mockImplementation(
                (capability) => capability === MatrixCapabilities.StickerSending,
            );
            const ev = createTransportEvent<IStickerActionRequest>({ name: "foo", content: { url: "bar" } });
            const dispatch = (defaultDispatcher.dispatch = jest.fn());
            actionFns[`action:${WidgetApiFromWidgetAction.SendSticker}`](ev);
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
            expect(dispatch).toHaveBeenCalledWith({
                action: "m.sticker",
                data: { content: { url: "bar" }, name: "foo" },
                widgetId: "test",
            });
        });
    });
});

describe("WidgetMessaging action handling for stickerpicker", () => {
    let widget: WidgetMessaging;
    let messaging: MockedObject<ClientWidgetApi>;
    let actionFns: Record<string, (ev: any) => void>;
    let room: Room;

    beforeEach(() => {
        const client = mocked(stubClient());
        room = mkRoom(client, "!1:example.org");
        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        const getRoomId = jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId") as unknown as MockedFunction<
            () => string | null
        >;
        getRoomId.mockReturnValue(room.roomId);
        const app: IApp = {
            id: "test",
            creatorUserId: "@alice:example.org",
            type: WidgetType.STICKERPICKER.preferred,
            url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
            roomId: room.roomId,
        };
        widget = new WidgetMessaging(new ElementWidget(app), {
            app,
            room,
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.start(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
        Object.defineProperty(messaging, "transport", { value: { reply: jest.fn() } });
        actionFns = Object.fromEntries(messaging.on.mock.calls as any);
    });

    afterEach(() => {
        widget.stop();
        jest.resetAllMocks();
    });

    describe("open integrations manager", () => {
        let openIntegrationManager: jest.SpyInstance<void, Parameters<IntegrationManagerInstance["open"]>>;
        beforeEach(() => {
            // Trivial mock of ModalWidgetStore
            openIntegrationManager = jest.fn();
            const inst = IntegrationManagers.sharedInstance();
            jest.spyOn(inst, "getPrimaryManager").mockImplementation(
                () =>
                    ({
                        open: openIntegrationManager,
                    }) as any,
            );
        });

        it("open the integration manager", () => {
            const ev = createTransportEvent<IWidgetApiRequest>({ integType: "my_integ_type", integId: "my_integ_id" });
            const dispatch = (defaultDispatcher.dispatch = jest.fn());
            actionFns[`action:${ElementWidgetActions.OpenIntegrationManager}`](ev);
            expect(dispatch).toHaveBeenCalledWith({
                action: "stickerpicker_close",
            });
            expect(messaging.transport.reply).toHaveBeenCalledWith(ev.detail, {});
            expect(openIntegrationManager).toHaveBeenCalledWith(room, `type_my_integ_type`, "my_integ_id");
        });
    });
});
