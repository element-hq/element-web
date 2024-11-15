/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked, MockedObject } from "jest-mock";
import { last } from "lodash";
import {
    MatrixEvent,
    MatrixClient,
    ClientEvent,
    EventTimeline,
    EventType,
    MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import { ClientWidgetApi, WidgetApiFromWidgetAction } from "matrix-widget-api";
import { waitFor } from "jest-matrix-react";

import { stubClient, mkRoom, mkEvent } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { StopGapWidget } from "../../../../src/stores/widgets/StopGapWidget";
import { ElementWidgetActions } from "../../../../src/stores/widgets/ElementWidgetActions";
import { VoiceBroadcastInfoEventType, VoiceBroadcastRecording } from "../../../../src/voice-broadcast";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import ActiveWidgetStore from "../../../../src/stores/ActiveWidgetStore";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("matrix-widget-api/lib/ClientWidgetApi");

describe("StopGapWidget", () => {
    let client: MockedObject<MatrixClient>;
    let widget: StopGapWidget;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        widget = new StopGapWidget({
            app: {
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
                roomId: "!1:example.org",
            },
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.startMessaging(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
    });

    afterEach(() => {
        widget.stopMessaging();
    });

    it("should replace parameters in widget url template", () => {
        const originGetValue = SettingsStore.getValue;
        const spy = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "theme") return "my-theme-for-testing";
            return originGetValue(setting);
        });
        expect(widget.embedUrl).toBe(
            "https://example.org/?user-id=%40userId%3Amatrix.org&device-id=ABCDEFGHI&base-url=https%3A%2F%2Fmatrix-client.matrix.org&theme=my-theme-for-testing&widgetId=test&parentUrl=http%3A%2F%2Flocalhost%2F",
        );
        spy.mockClear();
    });

    it("feeds incoming to-device messages to the widget", async () => {
        const event = mkEvent({
            event: true,
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
        });

        client.emit(ClientEvent.ToDeviceEvent, event);
        await Promise.resolve(); // flush promises
        expect(messaging.feedToDevice).toHaveBeenCalledWith(event.getEffectiveEvent(), false);
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
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent(), "!1:example.org");

            client.emit(ClientEvent.Event, event2);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent(), "!1:example.org");
        });

        it("should not feed incoming event to the widget if seen already", async () => {
            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent(), "!1:example.org");

            client.emit(ClientEvent.Event, event2);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent(), "!1:example.org");

            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2.getEffectiveEvent(), "!1:example.org");
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
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event2Encrypted.getEffectiveEvent(), "!1:example.org");
            // …then event 1
            event1Encrypted.event.type = event1.getType();
            event1Encrypted.event.content = event1.getContent();
            decryptingSpy1.mockReturnValue(false);
            client.emit(MatrixEventEvent.Decrypted, event1Encrypted);
            // The events should be fed in that same order so that event 2
            // doesn't have to be blocked on the decryption of event 1 (or
            // worse, dropped)
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event1Encrypted.getEffectiveEvent(), "!1:example.org");
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
            expect(messaging.feedEvent).toHaveBeenCalledWith(event.getEffectiveEvent(), "!1:example.org");
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
            expect(messaging.feedEvent).toHaveBeenCalledWith(event1.getEffectiveEvent(), "!1:example.org");

            client.emit(ClientEvent.Event, event);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event.getEffectiveEvent(), "!1:example.org");

            client.emit(ClientEvent.Event, event1);
            expect(messaging.feedEvent).toHaveBeenCalledTimes(2);
            expect(messaging.feedEvent).toHaveBeenLastCalledWith(event.getEffectiveEvent(), "!1:example.org");
        });
    });

    describe("when there is a voice broadcast recording", () => {
        let voiceBroadcastInfoEvent: MatrixEvent;
        let voiceBroadcastRecording: VoiceBroadcastRecording;

        beforeEach(() => {
            voiceBroadcastInfoEvent = mkEvent({
                event: true,
                room: client.getRoom("x")?.roomId,
                user: client.getUserId()!,
                type: VoiceBroadcastInfoEventType,
                content: {},
            });
            voiceBroadcastRecording = new VoiceBroadcastRecording(voiceBroadcastInfoEvent, client);
            jest.spyOn(voiceBroadcastRecording, "pause");
            jest.spyOn(SdkContextClass.instance.voiceBroadcastRecordingsStore, "getCurrent").mockReturnValue(
                voiceBroadcastRecording,
            );
        });

        describe(`and receiving a action:${ElementWidgetActions.JoinCall} message`, () => {
            beforeEach(async () => {
                messaging.on.mock.calls.find(([event, listener]) => {
                    if (event === `action:${ElementWidgetActions.JoinCall}`) {
                        listener();
                        return true;
                    }
                });
            });

            it("should pause the current voice broadcast recording", () => {
                expect(voiceBroadcastRecording.pause).toHaveBeenCalled();
            });
        });
    });
});
describe("StopGapWidget with stickyPromise", () => {
    let client: MockedObject<MatrixClient>;
    let widget: StopGapWidget;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
    });

    afterEach(() => {
        widget.stopMessaging();
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
        widget = new StopGapWidget({
            app: {
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url",
                roomId: "!1:example.org",
            },
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
            stickyPromise: getStickyPromise,
        });

        const setPersistenceSpy = jest.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence");

        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.startMessaging(null as unknown as HTMLIFrameElement);
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
