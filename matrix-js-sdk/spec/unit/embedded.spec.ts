/**
 * @jest-environment jsdom
 */

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

// We have to use EventEmitter here to mock part of the matrix-widget-api
// project, which doesn't know about our TypeEventEmitter implementation at all
// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "events";
import { MockedObject } from "jest-mock";
import { WidgetApi, WidgetApiToWidgetAction, MatrixCapabilities, ITurnServer, IRoomEvent } from "matrix-widget-api";

import { createRoomWidgetClient, MsgType } from "../../src/matrix";
import { MatrixClient, ClientEvent, ITurnServer as IClientTurnServer } from "../../src/client";
import { SyncState } from "../../src/sync";
import { ICapabilities } from "../../src/embedded";
import { MatrixEvent } from "../../src/models/event";
import { ToDeviceBatch } from "../../src/models/ToDeviceMessage";
import { DeviceInfo } from "../../src/crypto/deviceinfo";

class MockWidgetApi extends EventEmitter {
    public start = jest.fn();
    public requestCapability = jest.fn();
    public requestCapabilities = jest.fn();
    public requestCapabilityForRoomTimeline = jest.fn();
    public requestCapabilityToSendEvent = jest.fn();
    public requestCapabilityToReceiveEvent = jest.fn();
    public requestCapabilityToSendMessage = jest.fn();
    public requestCapabilityToReceiveMessage = jest.fn();
    public requestCapabilityToSendState = jest.fn();
    public requestCapabilityToReceiveState = jest.fn();
    public requestCapabilityToSendToDevice = jest.fn();
    public requestCapabilityToReceiveToDevice = jest.fn();
    public sendRoomEvent = jest.fn(() => ({ event_id: `$${Math.random()}` }));
    public sendStateEvent = jest.fn();
    public sendToDevice = jest.fn();
    public readStateEvents = jest.fn(() => []);
    public getTurnServers = jest.fn(() => []);

    public transport = { reply: jest.fn() };
}

describe("RoomWidgetClient", () => {
    let widgetApi: MockedObject<WidgetApi>;
    let client: MatrixClient;

    beforeEach(() => {
        widgetApi = new MockWidgetApi() as unknown as MockedObject<WidgetApi>;
    });

    afterEach(() => {
        client.stopClient();
    });

    const makeClient = async (capabilities: ICapabilities): Promise<void> => {
        const baseUrl = "https://example.org";
        client = createRoomWidgetClient(widgetApi, capabilities, "!1:example.org", { baseUrl });
        expect(widgetApi.start).toHaveBeenCalled(); // needs to have been called early in order to not miss messages
        widgetApi.emit("ready");
        await client.startClient();
    };

    describe("events", () => {
        it("sends", async () => {
            await makeClient({ sendEvent: ["org.matrix.rageshake_request"] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToSendEvent).toHaveBeenCalledWith("org.matrix.rageshake_request");
            await client.sendEvent("!1:example.org", "org.matrix.rageshake_request", { request_id: 123 });
            expect(widgetApi.sendRoomEvent).toHaveBeenCalledWith(
                "org.matrix.rageshake_request",
                { request_id: 123 },
                "!1:example.org",
            );
        });

        it("receives", async () => {
            const event = new MatrixEvent({
                type: "org.matrix.rageshake_request",
                event_id: "$pduhfiidph",
                room_id: "!1:example.org",
                sender: "@alice:example.org",
                content: { request_id: 123 },
            }).getEffectiveEvent();

            await makeClient({ receiveEvent: ["org.matrix.rageshake_request"] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToReceiveEvent).toHaveBeenCalledWith("org.matrix.rageshake_request");

            const emittedEvent = new Promise<MatrixEvent>((resolve) => client.once(ClientEvent.Event, resolve));
            const emittedSync = new Promise<SyncState>((resolve) => client.once(ClientEvent.Sync, resolve));
            widgetApi.emit(
                `action:${WidgetApiToWidgetAction.SendEvent}`,
                new CustomEvent(`action:${WidgetApiToWidgetAction.SendEvent}`, { detail: { data: event } }),
            );

            // The client should've emitted about the received event
            expect((await emittedEvent).getEffectiveEvent()).toEqual(event);
            expect(await emittedSync).toEqual(SyncState.Syncing);
            // It should've also inserted the event into the room object
            const room = client.getRoom("!1:example.org");
            expect(room).not.toBeNull();
            expect(
                room!
                    .getLiveTimeline()
                    .getEvents()
                    .map((e) => e.getEffectiveEvent()),
            ).toEqual([event]);
        });
    });

    describe("messages", () => {
        it("requests permissions for specific message types", async () => {
            await makeClient({ sendMessage: [MsgType.Text], receiveMessage: [MsgType.Text] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToSendMessage).toHaveBeenCalledWith(MsgType.Text);
            expect(widgetApi.requestCapabilityToReceiveMessage).toHaveBeenCalledWith(MsgType.Text);
        });

        it("requests permissions for all message types", async () => {
            await makeClient({ sendMessage: true, receiveMessage: true });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToSendMessage).toHaveBeenCalledWith();
            expect(widgetApi.requestCapabilityToReceiveMessage).toHaveBeenCalledWith();
        });

        // No point in testing sending and receiving since it's done exactly the
        // same way as non-message events
    });

    describe("state events", () => {
        const event = new MatrixEvent({
            type: "org.example.foo",
            event_id: "$sfkjfsksdkfsd",
            room_id: "!1:example.org",
            sender: "@alice:example.org",
            state_key: "bar",
            content: { hello: "world" },
        }).getEffectiveEvent();

        it("sends", async () => {
            await makeClient({ sendState: [{ eventType: "org.example.foo", stateKey: "bar" }] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToSendState).toHaveBeenCalledWith("org.example.foo", "bar");
            await client.sendStateEvent("!1:example.org", "org.example.foo", { hello: "world" }, "bar");
            expect(widgetApi.sendStateEvent).toHaveBeenCalledWith(
                "org.example.foo",
                "bar",
                { hello: "world" },
                "!1:example.org",
            );
        });

        it("receives", async () => {
            await makeClient({ receiveState: [{ eventType: "org.example.foo", stateKey: "bar" }] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToReceiveState).toHaveBeenCalledWith("org.example.foo", "bar");

            const emittedEvent = new Promise<MatrixEvent>((resolve) => client.once(ClientEvent.Event, resolve));
            const emittedSync = new Promise<SyncState>((resolve) => client.once(ClientEvent.Sync, resolve));
            widgetApi.emit(
                `action:${WidgetApiToWidgetAction.SendEvent}`,
                new CustomEvent(`action:${WidgetApiToWidgetAction.SendEvent}`, { detail: { data: event } }),
            );

            // The client should've emitted about the received event
            expect((await emittedEvent).getEffectiveEvent()).toEqual(event);
            expect(await emittedSync).toEqual(SyncState.Syncing);
            // It should've also inserted the event into the room object
            const room = client.getRoom("!1:example.org");
            expect(room).not.toBeNull();
            expect(room!.currentState.getStateEvents("org.example.foo", "bar")?.getEffectiveEvent()).toEqual(event);
        });

        it("backfills", async () => {
            widgetApi.readStateEvents.mockImplementation(async (eventType, limit, stateKey) =>
                eventType === "org.example.foo" && (limit ?? Infinity) > 0 && stateKey === "bar"
                    ? [event as IRoomEvent]
                    : [],
            );

            await makeClient({ receiveState: [{ eventType: "org.example.foo", stateKey: "bar" }] });
            expect(widgetApi.requestCapabilityForRoomTimeline).toHaveBeenCalledWith("!1:example.org");
            expect(widgetApi.requestCapabilityToReceiveState).toHaveBeenCalledWith("org.example.foo", "bar");

            const room = client.getRoom("!1:example.org");
            expect(room).not.toBeNull();
            expect(room!.currentState.getStateEvents("org.example.foo", "bar")?.getEffectiveEvent()).toEqual(event);
        });
    });

    describe("to-device messages", () => {
        const unencryptedContentMap = new Map([
            ["@alice:example.org", new Map([["*", { hello: "alice!" }]])],
            ["@bob:example.org", new Map([["bobDesktop", { hello: "bob!" }]])],
        ]);

        const expectedRequestData = {
            ["@alice:example.org"]: { ["*"]: { hello: "alice!" } },
            ["@bob:example.org"]: { ["bobDesktop"]: { hello: "bob!" } },
        };

        it("sends unencrypted (sendToDevice)", async () => {
            await makeClient({ sendToDevice: ["org.example.foo"] });
            expect(widgetApi.requestCapabilityToSendToDevice).toHaveBeenCalledWith("org.example.foo");

            await client.sendToDevice("org.example.foo", unencryptedContentMap);
            expect(widgetApi.sendToDevice).toHaveBeenCalledWith("org.example.foo", false, expectedRequestData);
        });

        it("sends unencrypted (queueToDevice)", async () => {
            await makeClient({ sendToDevice: ["org.example.foo"] });
            expect(widgetApi.requestCapabilityToSendToDevice).toHaveBeenCalledWith("org.example.foo");

            const batch: ToDeviceBatch = {
                eventType: "org.example.foo",
                batch: [
                    { userId: "@alice:example.org", deviceId: "*", payload: { hello: "alice!" } },
                    { userId: "@bob:example.org", deviceId: "bobDesktop", payload: { hello: "bob!" } },
                ],
            };
            await client.queueToDevice(batch);
            expect(widgetApi.sendToDevice).toHaveBeenCalledWith("org.example.foo", false, expectedRequestData);
        });

        it("sends encrypted (encryptAndSendToDevices)", async () => {
            await makeClient({ sendToDevice: ["org.example.foo"] });
            expect(widgetApi.requestCapabilityToSendToDevice).toHaveBeenCalledWith("org.example.foo");

            const payload = { type: "org.example.foo", hello: "world" };
            await client.encryptAndSendToDevices(
                [
                    { userId: "@alice:example.org", deviceInfo: new DeviceInfo("aliceWeb") },
                    { userId: "@bob:example.org", deviceInfo: new DeviceInfo("bobDesktop") },
                ],
                payload,
            );
            expect(widgetApi.sendToDevice).toHaveBeenCalledWith("org.example.foo", true, {
                "@alice:example.org": { aliceWeb: payload },
                "@bob:example.org": { bobDesktop: payload },
            });
        });

        it.each([
            { encrypted: false, title: "unencrypted" },
            { encrypted: true, title: "encrypted" },
        ])("receives $title", async ({ encrypted }) => {
            await makeClient({ receiveToDevice: ["org.example.foo"] });
            expect(widgetApi.requestCapabilityToReceiveToDevice).toHaveBeenCalledWith("org.example.foo");

            const event = {
                type: "org.example.foo",
                sender: "@alice:example.org",
                encrypted,
                content: { hello: "world" },
            };

            const emittedEvent = new Promise<MatrixEvent>((resolve) => client.once(ClientEvent.ToDeviceEvent, resolve));
            const emittedSync = new Promise<SyncState>((resolve) => client.once(ClientEvent.Sync, resolve));
            widgetApi.emit(
                `action:${WidgetApiToWidgetAction.SendToDevice}`,
                new CustomEvent(`action:${WidgetApiToWidgetAction.SendToDevice}`, { detail: { data: event } }),
            );

            expect((await emittedEvent).getEffectiveEvent()).toEqual({
                type: event.type,
                sender: event.sender,
                content: event.content,
            });
            expect((await emittedEvent).isEncrypted()).toEqual(encrypted);
            expect(await emittedSync).toEqual(SyncState.Syncing);
        });
    });

    it("gets TURN servers", async () => {
        const server1: ITurnServer = {
            uris: [
                "turn:turn.example.com:3478?transport=udp",
                "turn:10.20.30.40:3478?transport=tcp",
                "turns:10.20.30.40:443?transport=tcp",
            ],
            username: "1443779631:@user:example.com",
            password: "JlKfBy1QwLrO20385QyAtEyIv0=",
        };
        const server2: ITurnServer = {
            uris: [
                "turn:turn.example.com:3478?transport=udp",
                "turn:10.20.30.40:3478?transport=tcp",
                "turns:10.20.30.40:443?transport=tcp",
            ],
            username: "1448999322:@user:example.com",
            password: "hunter2",
        };
        const clientServer1: IClientTurnServer = {
            urls: server1.uris,
            username: server1.username,
            credential: server1.password,
        };
        const clientServer2: IClientTurnServer = {
            urls: server2.uris,
            username: server2.username,
            credential: server2.password,
        };

        let emitServer2: () => void;
        const getServer2 = new Promise<ITurnServer>((resolve) => (emitServer2 = () => resolve(server2)));
        widgetApi.getTurnServers.mockImplementation(async function* () {
            yield server1;
            yield await getServer2;
        });

        await makeClient({ turnServers: true });
        expect(widgetApi.requestCapability).toHaveBeenCalledWith(MatrixCapabilities.MSC3846TurnServers);

        // The first server should've arrived immediately
        expect(client.getTurnServers()).toEqual([clientServer1]);

        // Subsequent servers arrive asynchronously and should emit an event
        const emittedServer = new Promise<IClientTurnServer[]>((resolve) =>
            client.once(ClientEvent.TurnServers, resolve),
        );
        emitServer2!();
        expect(await emittedServer).toEqual([clientServer2]);
        expect(client.getTurnServers()).toEqual([clientServer2]);
    });
});
