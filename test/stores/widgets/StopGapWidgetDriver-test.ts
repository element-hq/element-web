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

import { mocked, MockedObject } from "jest-mock";
import { MatrixClient, ClientEvent, ITurnServer as IClientTurnServer } from "matrix-js-sdk/src/client";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { Direction, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { Widget, MatrixWidgetType, WidgetKind, WidgetDriver, ITurnServer } from "matrix-widget-api";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import { StopGapWidgetDriver } from "../../../src/stores/widgets/StopGapWidgetDriver";
import { stubClient } from "../../test-utils";

describe("StopGapWidgetDriver", () => {
    let client: MockedObject<MatrixClient>;

    const mkDefaultDriver = (): WidgetDriver => new StopGapWidgetDriver(
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

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.get());
        client.getUserId.mockReturnValue("@alice:example.org");
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
            "org.matrix.msc2762.receive.state_event:m.room.member",
            "org.matrix.msc2762.send.state_event:org.matrix.msc3401.call",
            "org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call",
            "org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member#@alice:example.org",
            "org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call.member",
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
        ]);

        // As long as this resolves, we'll know that it didn't try to pop up a modal
        const approvedCapabilities = await driver.validateCapabilities(requestedCapabilities);
        expect(approvedCapabilities).toEqual(requestedCapabilities);
    });

    describe("sendToDevice", () => {
        const contentMap = {
            "@alice:example.org": {
                "*": {
                    hello: "alice",
                },
            },
            "@bob:example.org": {
                "bobDesktop": {
                    hello: "bob",
                },
            },
        };

        let driver: WidgetDriver;

        beforeEach(() => { driver = mkDefaultDriver(); });

        it("sends unencrypted messages", async () => {
            await driver.sendToDevice("org.example.foo", false, contentMap);
            expect(client.queueToDevice.mock.calls).toMatchSnapshot();
        });

        it("sends encrypted messages", async () => {
            const aliceWeb = new DeviceInfo("aliceWeb");
            const aliceMobile = new DeviceInfo("aliceMobile");
            const bobDesktop = new DeviceInfo("bobDesktop");

            mocked(client.crypto.deviceList).downloadKeys.mockResolvedValue({
                "@alice:example.org": { aliceWeb, aliceMobile },
                "@bob:example.org": { bobDesktop },
            });

            await driver.sendToDevice("org.example.foo", true, contentMap);
            expect(client.encryptAndSendToDevices.mock.calls).toMatchSnapshot();
        });
    });

    describe("getTurnServers", () => {
        let driver: WidgetDriver;

        beforeEach(() => { driver = mkDefaultDriver(); });

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

        beforeEach(() => { driver = mkDefaultDriver(); });

        it('reads related events from the current room', async () => {
            jest.spyOn(RoomViewStore.instance, 'getRoomId').mockReturnValue('!this-room-id');

            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [],
            });

            await expect(driver.readEventRelations('$event')).resolves.toEqual({
                chunk: [],
                nextBatch: undefined,
                prevBatch: undefined,
            });

            expect(client.relations).toBeCalledWith('!this-room-id', '$event', null, null, {});
        });

        it('reads related events from a selected room', async () => {
            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [new MatrixEvent(), new MatrixEvent()],
                nextBatch: 'next-batch-token',
            });

            await expect(driver.readEventRelations('$event', '!room-id')).resolves.toEqual({
                chunk: [
                    expect.objectContaining({ content: {} }),
                    expect.objectContaining({ content: {} }),
                ],
                nextBatch: 'next-batch-token',
                prevBatch: undefined,
            });

            expect(client.relations).toBeCalledWith('!room-id', '$event', null, null, {});
        });

        it('reads related events with custom parameters', async () => {
            client.relations.mockResolvedValue({
                originalEvent: new MatrixEvent(),
                events: [],
            });

            await expect(driver.readEventRelations(
                '$event',
                '!room-id',
                'm.reference',
                'm.room.message',
                'from-token',
                'to-token',
                25,
                'f',
            )).resolves.toEqual({
                chunk: [],
                nextBatch: undefined,
                prevBatch: undefined,
            });

            expect(client.relations).toBeCalledWith(
                '!room-id',
                '$event',
                'm.reference',
                'm.room.message',
                {
                    limit: 25,
                    from: 'from-token',
                    to: 'to-token',
                    dir: Direction.Forward,
                },
            );
        });
    });
});
