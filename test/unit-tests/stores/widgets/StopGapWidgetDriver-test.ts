/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type MockedObject } from "jest-mock";
import fetchMockJest from "fetch-mock-jest";
import {
    type MatrixClient,
    ClientEvent,
    type ITurnServer as IClientTurnServer,
    Direction,
    EventType,
    MatrixEvent,
    MsgType,
    RelationType,
    type Room,
} from "matrix-js-sdk/src/matrix";
import {
    Widget,
    MatrixWidgetType,
    WidgetKind,
    type WidgetDriver,
    type ITurnServer,
    SimpleObservable,
    OpenIDRequestState,
    type IOpenIDUpdate,
    UpdateDelayedEventAction,
} from "matrix-widget-api";
import {
    type ApprovalOpts,
    type CapabilitiesOpts,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { StopGapWidgetDriver } from "../../../../src/stores/widgets/StopGapWidgetDriver";
import { mkEvent, stubClient } from "../../../test-utils";
import { ModuleRunner } from "../../../../src/modules/ModuleRunner";
import dis from "../../../../src/dispatcher/dispatcher";
import Modal from "../../../../src/Modal";
import SettingsStore from "../../../../src/settings/SettingsStore";

describe("StopGapWidgetDriver", () => {
    let client: MockedObject<MatrixClient>;

    const mkDefaultDriver = (): WidgetDriver =>
        new StopGapWidgetDriver(
            [],
            new Widget({
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org",
            }),
            WidgetKind.Room,
            false,
            "!1:example.org",
        );

    jest.spyOn(Modal, "createDialog").mockImplementation(() => {
        throw new Error("Should not have to create a dialog");
    });

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");
        client.getSafeUserId.mockReturnValue("@alice:example.org");
    });

    it("auto-approves capabilities of virtual Element Call widgets", async () => {
        const driver = new StopGapWidgetDriver(
            [],
            new Widget({
                id: "group_call",
                creatorUserId: "@alice:example.org",
                type: MatrixWidgetType.Custom,
                url: "https://call.element.io",
            }),
            WidgetKind.Room,
            true,
            "!1:example.org",
        );

        // These are intentionally raw identifiers rather than constants, so it's obvious what's being requested
        const requestedCapabilities = new Set([
            "m.always_on_screen",
            "town.robin.msc3846.turn_servers",
            "org.matrix.msc2762.timeline:!1:example.org",
            "org.matrix.msc2762.send.event:org.matrix.rageshake_request",
            "org.matrix.msc2762.receive.event:org.matrix.rageshake_request",
            "org.matrix.msc2762.send.event:m.reaction",
            "org.matrix.msc2762.receive.event:m.reaction",
            "org.matrix.msc2762.send.event:m.room.redaction",
            "org.matrix.msc2762.receive.event:m.room.redaction",
            "org.matrix.msc2762.receive.state_event:m.room.create",
            "org.matrix.msc2762.receive.state_event:m.room.member",
            "org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call",
            "org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@alice:example.org",
            "org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call.member",
            `org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#_@alice:example.org_${client.deviceId}`,
            `org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@alice:example.org_${client.deviceId}`,
            "org.matrix.msc3819.send.to_device:m.call.invite",
            "org.matrix.msc3819.receive.to_device:m.call.invite",
            "org.matrix.msc3819.send.to_device:m.call.candidates",
            "org.matrix.msc3819.receive.to_device:m.call.candidates",
            "org.matrix.msc3819.send.to_device:m.call.answer",
            "org.matrix.msc3819.receive.to_device:m.call.answer",
            "org.matrix.msc3819.send.to_device:m.call.hangup",
            "org.matrix.msc3819.receive.to_device:m.call.hangup",
            "org.matrix.msc3819.send.to_device:m.call.reject",
            "org.matrix.msc3819.receive.to_device:m.call.reject",
            "org.matrix.msc3819.send.to_device:m.call.select_answer",
            "org.matrix.msc3819.receive.to_device:m.call.select_answer",
            "org.matrix.msc3819.send.to_device:m.call.negotiate",
            "org.matrix.msc3819.receive.to_device:m.call.negotiate",
            "org.matrix.msc3819.send.to_device:m.call.sdp_stream_metadata_changed",
            "org.matrix.msc3819.receive.to_device:m.call.sdp_stream_metadata_changed",
            "org.matrix.msc3819.send.to_device:org.matrix.call.sdp_stream_metadata_changed",
            "org.matrix.msc3819.receive.to_device:org.matrix.call.sdp_stream_metadata_changed",
            "org.matrix.msc3819.send.to_device:m.call.replaces",
            "org.matrix.msc3819.receive.to_device:m.call.replaces",
            "org.matrix.msc4157.send.delayed_event",
            "org.matrix.msc4157.update_delayed_event",
        ]);

        const approvedCapabilities = await driver.validateCapabilities(requestedCapabilities);
        expect(approvedCapabilities).toEqual(requestedCapabilities);
    });

    it("approves capabilities via module api", async () => {
        const driver = mkDefaultDriver();

        const requestedCapabilities = new Set(["org.matrix.msc2931.navigate", "org.matrix.msc2762.timeline:*"]);

        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation(
            (lifecycleEvent, opts, widgetInfo, requested) => {
                if (lifecycleEvent === WidgetLifecycle.CapabilitiesRequest) {
                    (opts as CapabilitiesOpts).approvedCapabilities = requested;
                }
            },
        );

        const approvedCapabilities = await driver.validateCapabilities(requestedCapabilities);
        expect(approvedCapabilities).toEqual(requestedCapabilities);
    });

    it("approves identity via module api", async () => {
        const driver = mkDefaultDriver();

        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
            if (lifecycleEvent === WidgetLifecycle.IdentityRequest) {
                (opts as ApprovalOpts).approved = true;
            }
        });

        const listener = jest.fn();
        const observer = new SimpleObservable<IOpenIDUpdate>();
        observer.onUpdate(listener);
        await driver.askOpenID(observer);

        const openIdUpdate: IOpenIDUpdate = {
            state: OpenIDRequestState.Allowed,
            token: await client.getOpenIdToken(),
        };
        expect(listener).toHaveBeenCalledWith(openIdUpdate);
    });

    describe("sendToDevice", () => {
        const contentMap = {
            "@alice:example.org": {
                "*": {
                    hello: "alice",
                },
            },
            "@bob:example.org": {
                bobDesktop: {
                    hello: "bob",
                },
            },
        };

        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("sends unencrypted messages", async () => {
            await driver.sendToDevice("org.example.foo", false, contentMap);
            expect(client.queueToDevice).toHaveBeenCalledWith({
                eventType: "org.example.foo",
                batch: [
                    { deviceId: "*", payload: { hello: "alice" }, userId: "@alice:example.org" },
                    { deviceId: "bobDesktop", payload: { hello: "bob" }, userId: "@bob:example.org" },
                ],
            });
        });

        it("sends encrypted messages", async () => {
            const encryptToDeviceMessages = jest
                .fn()
                .mockImplementation(
                    (eventType, recipients: { userId: string; deviceId: string }[], content: object) => ({
                        eventType: "m.room.encrypted",
                        batch: recipients.map(({ userId, deviceId }) => ({
                            userId,
                            deviceId,
                            payload: {
                                eventType,
                                content,
                            },
                        })),
                    }),
                );

            MatrixClientPeg.safeGet().getCrypto()!.encryptToDeviceMessages = encryptToDeviceMessages;

            await driver.sendToDevice("org.example.foo", true, {
                "@alice:example.org": {
                    aliceMobile: {
                        hello: "alice",
                    },
                },
                "@bob:example.org": {
                    bobDesktop: {
                        hello: "bob",
                    },
                },
            });

            expect(encryptToDeviceMessages).toHaveBeenCalledWith(
                "org.example.foo",
                [{ deviceId: "aliceMobile", userId: "@alice:example.org" }],
                {
                    hello: "alice",
                },
            );
            expect(encryptToDeviceMessages).toHaveBeenCalledWith(
                "org.example.foo",
                [{ deviceId: "bobDesktop", userId: "@bob:example.org" }],
                {
                    hello: "bob",
                },
            );
            expect(client.queueToDevice).toHaveBeenCalledWith({
                eventType: "m.room.encrypted",
                batch: expect.arrayContaining([
                    {
                        deviceId: "aliceMobile",
                        payload: { content: { hello: "alice" }, eventType: "org.example.foo" },
                        userId: "@alice:example.org",
                    },
                ]),
            });
            expect(client.queueToDevice).toHaveBeenCalledWith({
                eventType: "m.room.encrypted",
                batch: expect.arrayContaining([
                    {
                        deviceId: "bobDesktop",
                        payload: { content: { hello: "bob" }, eventType: "org.example.foo" },
                        userId: "@bob:example.org",
                    },
                ]),
            });
        });
    });

    describe("getTurnServers", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("stops if VoIP isn't supported", async () => {
            jest.spyOn(client, "pollingTurnServers", "get").mockReturnValue(false);
            const servers = driver.getTurnServers();
            expect(await servers.next()).toEqual({ value: undefined, done: true });
        });

        it("stops if the homeserver provides no TURN servers", async () => {
            const servers = driver.getTurnServers();
            expect(await servers.next()).toEqual({ value: undefined, done: true });
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

            client.getTurnServers.mockReturnValue([clientServer1]);
            const servers = driver.getTurnServers();
            expect(await servers.next()).toEqual({ value: server1, done: false });

            const nextServer = servers.next();
            client.getTurnServers.mockReturnValue([clientServer2]);
            client.emit(ClientEvent.TurnServers, [clientServer2]);
            expect(await nextServer).toEqual({ value: server2, done: false });

            await servers.return(undefined);
        });
    });

    describe("readEventRelations", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("reads related events from the current room", async () => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!this-room-id");

            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [],
            });

            await expect(driver.readEventRelations("$event")).resolves.toEqual({
                chunk: [],
                nextBatch: undefined,
                prevBatch: undefined,
            });

            expect(client.relations).toHaveBeenCalledWith("!this-room-id", "$event", null, null, {});
        });

        it("reads related events from a selected room", async () => {
            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [new MatrixEvent(), new MatrixEvent()],
                nextBatch: "next-batch-token",
            });

            await expect(driver.readEventRelations("$event", "!room-id")).resolves.toEqual({
                chunk: [expect.objectContaining({ content: {} }), expect.objectContaining({ content: {} })],
                nextBatch: "next-batch-token",
                prevBatch: undefined,
            });

            expect(client.relations).toHaveBeenCalledWith("!room-id", "$event", null, null, {});
        });

        it("reads related events with custom parameters", async () => {
            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [],
            });

            await expect(
                driver.readEventRelations(
                    "$event",
                    "!room-id",
                    "m.reference",
                    "m.room.message",
                    "from-token",
                    "to-token",
                    25,
                    "f",
                ),
            ).resolves.toEqual({
                chunk: [],
                nextBatch: undefined,
                prevBatch: undefined,
            });

            expect(client.relations).toHaveBeenCalledWith("!room-id", "$event", "m.reference", "m.room.message", {
                limit: 25,
                from: "from-token",
                to: "to-token",
                dir: Direction.Forward,
            });
        });
    });

    describe("chat effects", () => {
        let driver: WidgetDriver;
        // let client: MatrixClient;

        beforeEach(() => {
            stubClient();
            driver = mkDefaultDriver();
            jest.spyOn(dis, "dispatch").mockReset();
        });

        it("sends chat effects", async () => {
            await driver.sendEvent(
                EventType.RoomMessage,
                {
                    msgtype: MsgType.Text,
                    body: "🎉",
                },
                null,
            );

            expect(dis.dispatch).toHaveBeenCalled();
        });

        it("does not send chat effects in threads", async () => {
            await driver.sendEvent(
                EventType.RoomMessage,
                {
                    "body": "🎉",
                    "m.relates_to": {
                        rel_type: RelationType.Thread,
                        event_id: "$123",
                    },
                },
                null,
            );

            expect(dis.dispatch).not.toHaveBeenCalled();
        });
    });

    describe("sendDelayedEvent", () => {
        let driver: WidgetDriver;
        const roomId = "!this-room-id";

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("cannot send delayed events with missing arguments", async () => {
            await expect(driver.sendDelayedEvent(null, null, EventType.RoomMessage, {})).rejects.toThrow(
                "Must provide at least one of",
            );
        });

        it("sends delayed message events", async () => {
            client._unstable_sendDelayedEvent.mockResolvedValue({
                delay_id: "id",
            });

            await expect(driver.sendDelayedEvent(2000, null, EventType.RoomMessage, {})).resolves.toEqual({
                roomId,
                delayId: "id",
            });

            expect(client._unstable_sendDelayedEvent).toHaveBeenCalledWith(
                roomId,
                { delay: 2000 },
                null,
                EventType.RoomMessage,
                {},
            );
        });

        it("sends child action delayed message events", async () => {
            client._unstable_sendDelayedEvent.mockResolvedValue({
                delay_id: "id-child",
            });

            await expect(driver.sendDelayedEvent(null, "id-parent", EventType.RoomMessage, {})).resolves.toEqual({
                roomId,
                delayId: "id-child",
            });

            expect(client._unstable_sendDelayedEvent).toHaveBeenCalledWith(
                roomId,
                { parent_delay_id: "id-parent" },
                null,
                EventType.RoomMessage,
                {},
            );
        });

        it("sends delayed state events", async () => {
            client._unstable_sendDelayedStateEvent.mockResolvedValue({
                delay_id: "id",
            });

            await expect(driver.sendDelayedEvent(2000, null, EventType.RoomTopic, {}, "")).resolves.toEqual({
                roomId,
                delayId: "id",
            });

            expect(client._unstable_sendDelayedStateEvent).toHaveBeenCalledWith(
                roomId,
                { delay: 2000 },
                EventType.RoomTopic,
                {},
                "",
            );
        });

        it("sends child action delayed state events", async () => {
            client._unstable_sendDelayedStateEvent.mockResolvedValue({
                delay_id: "id-child",
            });

            await expect(driver.sendDelayedEvent(null, "id-parent", EventType.RoomTopic, {}, "")).resolves.toEqual({
                roomId,
                delayId: "id-child",
            });

            expect(client._unstable_sendDelayedStateEvent).toHaveBeenCalledWith(
                roomId,
                { parent_delay_id: "id-parent" },
                EventType.RoomTopic,
                {},
                "",
            );
        });
    });

    describe("updateDelayedEvent", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("updates delayed events", async () => {
            client._unstable_updateDelayedEvent.mockResolvedValue({});
            for (const action of [
                UpdateDelayedEventAction.Cancel,
                UpdateDelayedEventAction.Restart,
                UpdateDelayedEventAction.Send,
            ]) {
                await expect(driver.updateDelayedEvent("id", action)).resolves.toBeUndefined();
                expect(client._unstable_updateDelayedEvent).toHaveBeenCalledWith("id", action);
            }
        });

        it("fails to update delayed events", async () => {
            const errorMessage = "Cannot restart this delayed event";
            client._unstable_updateDelayedEvent.mockRejectedValue(new Error(errorMessage));
            await expect(driver.updateDelayedEvent("id", UpdateDelayedEventAction.Restart)).rejects.toThrow(
                errorMessage,
            );
        });
    });

    describe("If the feature_dynamic_room_predecessors feature is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("passes the flag through to getVisibleRooms", () => {
            const driver = mkDefaultDriver();
            driver.getKnownRooms();
            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("passes the flag through to getVisibleRooms", () => {
            const driver = mkDefaultDriver();
            driver.getKnownRooms();
            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });

    describe("searchUserDirectory", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("searches for users in the user directory", async () => {
            client.searchUserDirectory.mockResolvedValue({
                limited: false,
                results: [{ user_id: "@user", display_name: "Name", avatar_url: "mxc://" }],
            });

            await expect(driver.searchUserDirectory("foo")).resolves.toEqual({
                limited: false,
                results: [{ userId: "@user", displayName: "Name", avatarUrl: "mxc://" }],
            });

            expect(client.searchUserDirectory).toHaveBeenCalledWith({ term: "foo", limit: undefined });
        });

        it("searches for users with a custom limit", async () => {
            client.searchUserDirectory.mockResolvedValue({
                limited: true,
                results: [],
            });

            await expect(driver.searchUserDirectory("foo", 25)).resolves.toEqual({
                limited: true,
                results: [],
            });

            expect(client.searchUserDirectory).toHaveBeenCalledWith({ term: "foo", limit: 25 });
        });
    });

    describe("getMediaConfig", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("gets the media configuration", async () => {
            client.getMediaConfig.mockResolvedValue({
                "m.upload.size": 1000,
            });

            await expect(driver.getMediaConfig()).resolves.toEqual({
                "m.upload.size": 1000,
            });

            expect(client.getMediaConfig).toHaveBeenCalledWith();
        });
    });

    describe("uploadFile", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("uploads a file", async () => {
            client.uploadContent.mockResolvedValue({
                content_uri: "mxc://...",
            });

            await expect(driver.uploadFile("data")).resolves.toEqual({
                contentUri: "mxc://...",
            });

            expect(client.uploadContent).toHaveBeenCalledWith("data");
        });
    });

    describe("downloadFile", () => {
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
        });

        it("should download a file and return the blob", async () => {
            // eslint-disable-next-line no-restricted-properties
            client.mxcUrlToHttp.mockImplementation((mxcUrl) => {
                if (mxcUrl === "mxc://example.com/test_file") {
                    return "https://example.com/_matrix/media/v3/download/example.com/test_file";
                }

                return null;
            });

            fetchMockJest.get("https://example.com/_matrix/media/v3/download/example.com/test_file", "test contents");

            const result = await driver.downloadFile("mxc://example.com/test_file");
            // A type test is impossible here because of
            // https://github.com/jefflau/jest-fetch-mock/issues/209
            // Tell TypeScript that file is a blob.
            const file = result.file as Blob;
            await expect(file.text()).resolves.toEqual("test contents");
        });
    });

    describe("readRoomTimeline", () => {
        const event1 = mkEvent({
            event: true,
            id: "$event-id1",
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
            room: "!1:example.org",
        });
        const event2 = mkEvent({
            event: true,
            id: "$event-id2",
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
            room: "!1:example.org",
        });
        let driver: WidgetDriver;

        beforeEach(() => {
            driver = mkDefaultDriver();
            client.getRoom.mockReturnValue({
                getLiveTimeline: () => ({ getEvents: () => [event1, event2] }),
            } as unknown as Room);
        });

        it("reads all events", async () => {
            expect(
                await driver.readRoomTimeline("!1:example.org", "org.example.foo", undefined, undefined, 10, undefined),
            ).toEqual([event2, event1].map((e) => e.getEffectiveEvent()));
        });

        it("reads up to a limit", async () => {
            expect(
                await driver.readRoomTimeline("!1:example.org", "org.example.foo", undefined, undefined, 1, undefined),
            ).toEqual([event2.getEffectiveEvent()]);
        });

        it("reads up to a specific event", async () => {
            expect(
                await driver.readRoomTimeline(
                    "!1:example.org",
                    "org.example.foo",
                    undefined,
                    undefined,
                    10,
                    event1.getId(),
                ),
            ).toEqual([event2.getEffectiveEvent()]);
        });
    });

    describe("readRoomState", () => {
        const event1 = mkEvent({
            event: true,
            id: "$event-id1",
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
            skey: "1",
            room: "!1:example.org",
        });
        const event2 = mkEvent({
            event: true,
            id: "$event-id2",
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
            skey: "2",
            room: "!1:example.org",
        });
        let driver: WidgetDriver;
        let getStateEvents: jest.Mock;

        beforeEach(() => {
            driver = mkDefaultDriver();
            getStateEvents = jest.fn();
            client.getRoom.mockReturnValue({
                getLiveTimeline: () => ({ getState: () => ({ getStateEvents }) }),
            } as unknown as Room);
        });

        it("reads a specific state key", async () => {
            getStateEvents.mockImplementation((eventType, stateKey) => {
                if (eventType === "org.example.foo" && stateKey === "1") return event1;
                return undefined;
            });
            expect(await driver.readRoomState("!1:example.org", "org.example.foo", "1")).toEqual([
                event1.getEffectiveEvent(),
            ]);
        });

        it("reads all state keys", async () => {
            getStateEvents.mockImplementation((eventType, stateKey) => {
                if (eventType === "org.example.foo" && stateKey === undefined) return [event1, event2];
                return [];
            });
            expect(await driver.readRoomState("!1:example.org", "org.example.foo", undefined)).toEqual(
                [event1, event2].map((e) => e.getEffectiveEvent()),
            );
        });
    });
});
