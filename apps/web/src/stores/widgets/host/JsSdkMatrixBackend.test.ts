/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
    ClientEvent,
    ConnectionError,
    EventType,
    type MatrixClient,
    type MatrixEvent,
    MatrixError,
    MatrixEventEvent,
    Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient } from "test-utils";
import type { RoomSink, StateKeySelector } from "@matrix-widget-tools/widget-host-bindings";

import { JsSdkMatrixBackend } from "./JsSdkMatrixBackend";
import { createFakeCodec, FakeBackendFailed } from "./bindings-mock";
import { OwnProfileStore } from "../../OwnProfileStore";
import * as Media from "../../../customisations/Media";
import SdkConfig from "../../../SdkConfig";

const ROOM_ID = "!room:example.org";
const USER_ID = "@userId:matrix.org";

describe("JsSdkMatrixBackend", () => {
    let client: MatrixClient;
    let room: Room;
    let backend: JsSdkMatrixBackend;

    const codec = createFakeCodec();
    const anyKey = { tag: "Any" } as unknown as StateKeySelector;
    const key = (k: string): StateKeySelector => ({ tag: "Key", inner: { key: k } }) as unknown as StateKeySelector;

    const mkMessage = (body: string, ts = 1): MatrixEvent =>
        mkEvent({ event: true, type: EventType.RoomMessage, room: ROOM_ID, user: USER_ID, content: { body }, ts });
    const mkTopic = (topic: string, ts = 1): MatrixEvent =>
        mkEvent({
            event: true,
            type: EventType.RoomTopic,
            room: ROOM_ID,
            user: USER_ID,
            skey: "",
            content: { topic },
            ts,
        });

    beforeEach(() => {
        client = stubClient();
        room = new Room(ROOM_ID, client, USER_ID);
        vi.mocked(client.getRoom).mockImplementation((roomId) => (roomId === ROOM_ID ? room : null));
        backend = new JsSdkMatrixBackend(client, room, codec);
    });

    afterEach(() => {
        backend.dispose();
        vi.restoreAllMocks();
    });

    it("reports the identity the widget context is built from", () => {
        vi.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");
        vi.spyOn(OwnProfileStore.instance, "getHttpAvatarUrl").mockReturnValue("https://example.org/avatar.png");

        expect(backend.roomId()).toBe(ROOM_ID);
        expect(backend.ownUserId()).toBe(USER_ID);
        expect(backend.ownDeviceId()).toBe("ABCDEFGHI");
        expect(backend.displayName()).toBe("Alice");
        expect(backend.avatarUrl()).toBe("https://example.org/avatar.png");
        expect(backend.baseUrl()).toBe("https://matrix-client.matrix.org");
    });

    it("falls back to empty strings when the profile is not loaded", () => {
        vi.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue(null);
        vi.spyOn(OwnProfileStore.instance, "getHttpAvatarUrl").mockReturnValue(null);
        vi.mocked(client.getDeviceId).mockReturnValue(null);

        expect(backend.displayName()).toBe("");
        expect(backend.avatarUrl()).toBe("");
        expect(backend.ownDeviceId()).toBe("");
    });

    describe("sending", () => {
        it("sends room events", async () => {
            vi.mocked(client.sendEvent).mockResolvedValue({ event_id: "$sent" });
            const content = { msgtype: "m.text", body: "hi" };

            await expect(backend.sendRoomEvent(ROOM_ID, EventType.RoomMessage, content)).resolves.toBe("$sent");
            expect(client.sendEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomMessage, content);
        });

        it("redacts instead of sending for redaction events", async () => {
            vi.mocked(client.redactEvent).mockResolvedValue({ event_id: "$redaction" });

            await expect(backend.sendRoomEvent(ROOM_ID, EventType.RoomRedaction, { redacts: "$ev" })).resolves.toBe(
                "$redaction",
            );
            expect(client.redactEvent).toHaveBeenCalledWith(ROOM_ID, "$ev");
            expect(client.sendEvent).not.toHaveBeenCalled();
        });

        it("sends state events", async () => {
            vi.mocked(client.sendStateEvent).mockResolvedValue({ event_id: "$state" });

            await expect(backend.sendStateEvent(ROOM_ID, EventType.RoomTopic, "", { topic: "t" })).resolves.toBe(
                "$state",
            );
            expect(client.sendStateEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomTopic, { topic: "t" }, "");
        });

        it("sends sticky and delayed events through the unstable client APIs", async () => {
            vi.mocked(client._unstable_sendStickyEvent).mockResolvedValue({ event_id: "$sticky" });
            vi.mocked(client._unstable_sendDelayedEvent).mockResolvedValue({ delay_id: "d1" });
            vi.mocked(client._unstable_sendDelayedStateEvent).mockResolvedValue({ delay_id: "d2" });
            vi.mocked(client._unstable_sendStickyDelayedEvent).mockResolvedValue({ delay_id: "d3" });

            await expect(backend.sendStickyEvent(ROOM_ID, "m.custom", { a: 1 }, 5000n)).resolves.toBe("$sticky");
            expect(client._unstable_sendStickyEvent).toHaveBeenCalledWith(ROOM_ID, 5000, null, "m.custom", { a: 1 });

            await expect(backend.sendDelayedEvent(ROOM_ID, "m.custom", undefined, { a: 1 }, 100n)).resolves.toBe("d1");
            expect(client._unstable_sendDelayedEvent).toHaveBeenCalledWith(ROOM_ID, 100, null, "m.custom", { a: 1 });

            await expect(backend.sendDelayedEvent(ROOM_ID, "m.custom", "k", { a: 1 }, 100n)).resolves.toBe("d2");
            expect(client._unstable_sendDelayedStateEvent).toHaveBeenCalledWith(
                ROOM_ID,
                100,
                "m.custom",
                { a: 1 },
                "k",
            );

            await expect(backend.sendDelayedStickyEvent(ROOM_ID, "m.custom", { a: 1 }, 100n, 5000n)).resolves.toBe(
                "d3",
            );
            expect(client._unstable_sendStickyDelayedEvent).toHaveBeenCalledWith(ROOM_ID, 5000, 100, null, "m.custom", {
                a: 1,
            });

            await backend.restartDelayedEvent(ROOM_ID, "d1");
            await backend.cancelDelayedEvent(ROOM_ID, "d2");
            await backend.sendDelayedEventNow(ROOM_ID, "d3");
            expect(client._unstable_restartScheduledDelayedEvent).toHaveBeenCalledWith("d1");
            expect(client._unstable_cancelScheduledDelayedEvent).toHaveBeenCalledWith("d2");
            expect(client._unstable_sendScheduledDelayedEvent).toHaveBeenCalledWith("d3");
        });

        it("translates client errors into the driver's error type", async () => {
            vi.mocked(client.sendEvent).mockRejectedValueOnce(
                new MatrixError({ errcode: "M_FORBIDDEN", error: "nope" }, 403),
            );
            await expect(backend.sendRoomEvent(ROOM_ID, "m.custom", {})).rejects.toMatchObject({
                inner: { errcode: "M_FORBIDDEN", status: 403, reason: expect.stringContaining("nope") },
            });

            vi.mocked(client.sendEvent).mockRejectedValueOnce(new ConnectionError("offline"));
            await expect(backend.sendRoomEvent(ROOM_ID, "m.custom", {})).rejects.toMatchObject({
                inner: { reason: expect.stringContaining("offline") },
            });

            vi.mocked(client.sendEvent).mockRejectedValueOnce("weird");
            const error = await backend.sendRoomEvent(ROOM_ID, "m.custom", {}).catch((e) => e);
            expect(error).toBeInstanceOf(FakeBackendFailed);
            expect(error.inner.reason).toBe("weird");
        });
    });

    describe("reading", () => {
        beforeEach(async () => {
            await room.addLiveEvents(
                [mkMessage("one", 1), mkTopic("topic", 2), mkMessage("two", 3), mkMessage("three", 4)],
                {
                    addToState: true,
                },
            );
        });

        it("reads the most recent timeline events of a type, oldest first", async () => {
            const events = await backend.readRoomEvents(ROOM_ID, EventType.RoomMessage, undefined, 2, undefined);
            expect(events.map((ev) => (ev.content as { body: string }).body)).toEqual(["two", "three"]);
            expect(events[0]).toMatchObject({ eventType: EventType.RoomMessage, roomId: ROOM_ID, sender: USER_ID });
        });

        it("reads everything when the limit is zero", async () => {
            const events = await backend.readRoomEvents(ROOM_ID, EventType.RoomMessage, undefined, 0, undefined);
            expect(events).toHaveLength(3);
        });

        it("reads room state by type and by key", async () => {
            const all = await backend.readRoomState(ROOM_ID, EventType.RoomTopic, anyKey);
            expect(all).toHaveLength(1);
            expect(all[0]).toMatchObject({ stateKey: "", content: { topic: "topic" } });

            await expect(backend.readRoomState(ROOM_ID, EventType.RoomTopic, key(""))).resolves.toHaveLength(1);
            await expect(backend.readRoomState(ROOM_ID, EventType.RoomTopic, key("other"))).resolves.toEqual([]);
        });

        it("rejects unknown rooms", async () => {
            await expect(
                backend.readRoomEvents("!other:example.org", "m.x", undefined, 1, undefined),
            ).rejects.toBeInstanceOf(FakeBackendFailed);
        });

        it("reads relations through the client", async () => {
            vi.mocked(client.relations).mockResolvedValue({
                events: [mkMessage("reply")],
                nextBatch: "n",
                prevBatch: null,
            });

            const result = await backend.relations(ROOM_ID, "$root", "m.thread", undefined, undefined, undefined, 5, 1);

            expect(client.relations).toHaveBeenCalledWith(ROOM_ID, "$root", "m.thread", null, {
                from: undefined,
                to: undefined,
                limit: 5,
                dir: "b",
            });
            expect(result.chunk).toHaveLength(1);
            expect(result.nextBatch).toBe("n");
            expect(result.prevBatch).toBeUndefined();
        });
    });

    it("fetches an OpenID token", async () => {
        vi.mocked(client.getOpenIdToken).mockResolvedValue({
            access_token: "t",
            token_type: "Bearer",
            matrix_server_name: "example.org",
            expires_in: 3600,
        });

        await expect(backend.openidToken()).resolves.toEqual({
            accessToken: "t",
            tokenType: "Bearer",
            matrixServerName: "example.org",
            expiresIn: 3600n,
        });
    });

    describe("homeserver requests", () => {
        it("returns the RTC transports, falling back to .well-known on old homeservers", async () => {
            const wait = vi.fn().mockResolvedValue([{ type: "livekit" }]);
            Object.defineProperty(client, "cachedRtcTransports", { value: { wait }, configurable: true });
            await expect(backend.rtcTransports()).resolves.toEqual([{ type: "livekit" }]);

            wait.mockRejectedValue(new MatrixError({ errcode: "M_UNRECOGNIZED", error: "nope" }, 404));
            vi.spyOn(SdkConfig, "get").mockReturnValue(true);
            client.waitForClientWellKnown = vi
                .fn()
                .mockResolvedValue({ "org.matrix.msc4143.rtc_foci": [{ type: "well-known" }] });
            await expect(backend.rtcTransports()).resolves.toEqual([{ type: "well-known" }]);

            client.waitForClientWellKnown = vi.fn().mockResolvedValue({});
            await expect(backend.rtcTransports()).rejects.toMatchObject({ inner: { errcode: "M_UNRECOGNIZED" } });
        });

        it("searches the user directory", async () => {
            client.searchUserDirectory = vi.fn().mockResolvedValue({
                limited: true,
                results: [{ user_id: "@bob:example.org", display_name: "Bob", avatar_url: "mxc://a/b" }],
            });

            await expect(backend.searchUserDirectory("bo", 5)).resolves.toEqual({
                limited: true,
                results: [{ userId: "@bob:example.org", displayName: "Bob", avatarUrl: "mxc://a/b" }],
            });
            expect(client.searchUserDirectory).toHaveBeenCalledWith({ term: "bo", limit: 5 });
        });

        it("reads the media config, and uploads and downloads media", async () => {
            client.getMediaConfig = vi.fn().mockResolvedValue({ "m.upload.size": 1024 });
            await expect(backend.mediaConfig()).resolves.toEqual({ uploadSize: 1024n });
            client.getMediaConfig = vi.fn().mockResolvedValue({});
            await expect(backend.mediaConfig()).resolves.toEqual({ uploadSize: undefined });

            client.uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://example.org/up" });
            const data = new TextEncoder().encode("hello").buffer;
            await expect(backend.uploadMedia({ data, mimetype: "text/plain" })).resolves.toBe("mxc://example.org/up");
            const uploaded = vi.mocked(client.uploadContent).mock.calls[0][0] as Blob;
            expect(uploaded.type).toBe("text/plain");
            expect(uploaded.size).toBe(5);

            const blob = new Blob(["world"], { type: "text/plain" });
            vi.spyOn(Media, "mediaFromMxc").mockReturnValue({
                downloadSource: () => Promise.resolve({ blob: () => Promise.resolve(blob) }),
            } as unknown as ReturnType<typeof Media.mediaFromMxc>);
            const file = await backend.downloadMedia("mxc://example.org/down");
            expect(new TextDecoder().decode(file.data)).toBe("world");
            expect(file.mimetype).toBe("text/plain");
        });

        it("reads room account data", async () => {
            await expect(backend.readRoomAccountData(ROOM_ID, "m.tag")).resolves.toEqual([]);

            room.addAccountData([mkEvent({ event: true, type: "m.tag", user: USER_ID, content: { tags: {} } })]);
            await expect(backend.readRoomAccountData(ROOM_ID, "m.tag")).resolves.toEqual([
                { eventType: "m.tag", roomId: ROOM_ID, content: { tags: {} } },
            ]);
        });

        it("gets a LiveKit token and delegates a delayed leave", async () => {
            client._unstable_getLivekitToken = vi.fn().mockResolvedValue({ jwt: "token" });
            client._unstable_delegateDelayedLeave = vi.fn().mockResolvedValue({});

            await expect(
                backend.rtcLivekitGetToken("example.org", "https://sfu.example", ROOM_ID, "slot", "member"),
            ).resolves.toBe("token");
            expect(client._unstable_getLivekitToken).toHaveBeenCalledWith({
                server_name: "example.org",
                url: "https://sfu.example",
                room_id: ROOM_ID,
                slot_id: "slot",
                member_id: "member",
            });

            await backend.rtcLivekitDelegateDelayedLeave("wss://sfu.example", ROOM_ID, "slot", "member", "delay");
            expect(client._unstable_delegateDelayedLeave).toHaveBeenCalledWith({
                url: "wss://sfu.example",
                room_id: ROOM_ID,
                slot_id: "slot",
                member_id: "member",
                delay_id: "delay",
            });
        });

        it("forwards the current TURN server and every refresh until cancelled", () => {
            const first = { urls: ["turn:a"], username: "u1", credential: "p1" };
            const second = { urls: ["turn:b"], username: "u2", credential: "p2" };
            client.getTurnServers = vi.fn().mockReturnValue([first]);
            const sink = { onTurnServer: vi.fn<(server: unknown) => void>() };

            const subscription = backend.subscribeTurnServers(sink);
            expect(sink.onTurnServer).toHaveBeenCalledWith({ uris: ["turn:a"], username: "u1", password: "p1" });

            client.emit(ClientEvent.TurnServers, [second]);
            expect(sink.onTurnServer).toHaveBeenLastCalledWith({ uris: ["turn:b"], username: "u2", password: "p2" });

            subscription.cancel();
            client.emit(ClientEvent.TurnServers, [first]);
            expect(sink.onTurnServer).toHaveBeenCalledTimes(2);
        });
    });

    describe("to-device", () => {
        it("queues plaintext messages as they are", async () => {
            const messages = [
                { userId: "@bob:example.org", deviceId: "DEV1", content: { a: 1 } },
                { userId: "@bob:example.org", deviceId: "*", content: { a: 2 } },
            ];

            const deliveries = await backend.sendToDeviceMessage(false, "m.custom", messages);

            expect(client.queueToDevice).toHaveBeenCalledWith({
                eventType: "m.custom",
                batch: [
                    { userId: "@bob:example.org", deviceId: "DEV1", payload: { a: 1 } },
                    { userId: "@bob:example.org", deviceId: "*", payload: { a: 2 } },
                ],
            });
            expect(deliveries).toEqual([
                { userId: "@bob:example.org", deviceId: "DEV1" },
                { userId: "@bob:example.org", deviceId: "*" },
            ]);
        });

        it("encrypts messages per content, expanding wildcard devices", async () => {
            const crypto = client.getCrypto()!;
            vi.mocked(crypto.getUserDeviceInfo).mockResolvedValue(
                new Map([
                    [
                        "@bob:example.org",
                        new Map([
                            ["DEV1", {}],
                            ["DEV2", {}],
                        ]) as never,
                    ],
                ]),
            );
            const encryptToDeviceMessages = vi.fn().mockResolvedValue({ eventType: "m.room.encrypted", batch: [] });
            (crypto as unknown as { encryptToDeviceMessages: typeof encryptToDeviceMessages }).encryptToDeviceMessages =
                encryptToDeviceMessages;

            await backend.sendToDeviceMessage(true, "m.custom", [
                { userId: "@bob:example.org", deviceId: "*", content: { a: 1 } },
                { userId: "@carol:example.org", deviceId: "DEV9", content: { a: 1 } },
            ]);

            expect(encryptToDeviceMessages).toHaveBeenCalledTimes(1);
            expect(encryptToDeviceMessages).toHaveBeenCalledWith(
                "m.custom",
                [
                    { userId: "@bob:example.org", deviceId: "DEV1" },
                    { userId: "@bob:example.org", deviceId: "DEV2" },
                    { userId: "@carol:example.org", deviceId: "DEV9" },
                ],
                { a: 1 },
            );
            expect(client.queueToDevice).toHaveBeenCalledWith({ eventType: "m.room.encrypted", batch: [] });
        });

        it("refuses encrypted sends without crypto", async () => {
            vi.mocked(client.getCrypto).mockReturnValue(undefined);
            await expect(backend.sendToDeviceMessage(true, "m.custom", [])).rejects.toBeInstanceOf(FakeBackendFailed);
        });

        it("forwards received messages of the subscribed types until cancelled", () => {
            const sink = { onToDeviceMessage: vi.fn<(message: unknown) => void>() };
            const subscription = backend.subscribeToDevice(["m.custom"], sink);

            client.emit(ClientEvent.ReceivedToDeviceMessage, {
                message: { type: "m.custom", sender: "@bob:example.org", content: { a: 1 } },
                encryptionInfo: { sender: "@bob:example.org" } as never,
            });
            client.emit(ClientEvent.ReceivedToDeviceMessage, {
                message: { type: "m.other", sender: "@bob:example.org", content: {} },
                encryptionInfo: null,
            });
            expect(sink.onToDeviceMessage).toHaveBeenCalledTimes(1);
            expect(sink.onToDeviceMessage).toHaveBeenCalledWith({
                eventType: "m.custom",
                sender: "@bob:example.org",
                content: { a: 1 },
                encrypted: true,
            });

            subscription.cancel();
            client.emit(ClientEvent.ReceivedToDeviceMessage, {
                message: { type: "m.custom", sender: "@bob:example.org", content: {} },
                encryptionInfo: null,
            });
            expect(sink.onToDeviceMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeRoom", () => {
        let sink: {
            onTimelineEvents: Mock<RoomSink["onTimelineEvents"]>;
            onStateEvents: Mock<RoomSink["onStateEvents"]>;
        };

        beforeEach(() => {
            sink = { onTimelineEvents: vi.fn(), onStateEvents: vi.fn() };
        });

        it("delivers the current state of every requested type right away", async () => {
            await room.addLiveEvents([mkTopic("topic")], { addToState: true });

            backend.subscribeRoom(
                ROOM_ID,
                { timelineEventTypes: [], stateEventTypes: [EventType.RoomTopic, EventType.RoomName] },
                sink,
            );

            expect(sink.onStateEvents).toHaveBeenCalledTimes(2);
            expect(sink.onStateEvents).toHaveBeenCalledWith(EventType.RoomTopic, [
                expect.objectContaining({ content: { topic: "topic" } }),
            ]);
            expect(sink.onStateEvents).toHaveBeenCalledWith(EventType.RoomName, []);
        });

        it("forwards new live timeline events of the requested types", async () => {
            backend.subscribeRoom(ROOM_ID, { timelineEventTypes: [EventType.RoomMessage], stateEventTypes: [] }, sink);

            await room.addLiveEvents(
                [
                    mkMessage("hello"),
                    mkEvent({ event: true, type: "m.other", room: ROOM_ID, user: USER_ID, content: {} }),
                ],
                {
                    addToState: true,
                },
            );

            expect(sink.onTimelineEvents).toHaveBeenCalledTimes(1);
            expect(sink.onTimelineEvents).toHaveBeenCalledWith([
                expect.objectContaining({ content: { body: "hello" } }),
            ]);
        });

        it("ignores backfilled events", () => {
            backend.subscribeRoom(ROOM_ID, { timelineEventTypes: [EventType.RoomMessage], stateEventTypes: [] }, sink);

            room.emit(RoomEvent.Timeline, mkMessage("old"), room, true, false, {
                timeline: room.getLiveTimeline(),
                liveEvent: false,
            });

            expect(sink.onTimelineEvents).not.toHaveBeenCalled();
        });

        it("waits for events to be decrypted before forwarding them", () => {
            backend.subscribeRoom(ROOM_ID, { timelineEventTypes: [EventType.RoomMessage], stateEventTypes: [] }, sink);
            const ev = mkMessage("secret");
            const beingDecrypted = vi.spyOn(ev, "isBeingDecrypted").mockReturnValue(true);

            room.emit(RoomEvent.Timeline, ev, room, false, false, {
                timeline: room.getLiveTimeline(),
                liveEvent: true,
            });
            expect(sink.onTimelineEvents).not.toHaveBeenCalled();

            beingDecrypted.mockReturnValue(false);
            ev.emit(MatrixEventEvent.Decrypted, ev);
            expect(sink.onTimelineEvents).toHaveBeenCalledWith([
                expect.objectContaining({ content: { body: "secret" } }),
            ]);
        });

        it("delivers the full state of a type once per tick when it changes", async () => {
            backend.subscribeRoom(ROOM_ID, { timelineEventTypes: [], stateEventTypes: [EventType.RoomTopic] }, sink);
            sink.onStateEvents.mockClear();

            // Two changes of the same type within one tick: delivered once, with the latest state
            await room.addLiveEvents([mkTopic("first", 1), mkTopic("second", 2)], { addToState: true });
            await Promise.resolve();

            expect(sink.onStateEvents).toHaveBeenCalledTimes(1);
            expect(sink.onStateEvents).toHaveBeenCalledWith(EventType.RoomTopic, [
                expect.objectContaining({ content: { topic: "second" } }),
            ]);
        });

        it("stops forwarding once cancelled or disposed", async () => {
            const subscription = backend.subscribeRoom(
                ROOM_ID,
                { timelineEventTypes: [EventType.RoomMessage], stateEventTypes: [EventType.RoomTopic] },
                sink,
            );
            sink.onStateEvents.mockClear();
            subscription.cancel();

            await room.addLiveEvents([mkMessage("after"), mkTopic("after")], { addToState: true });
            await Promise.resolve();
            expect(sink.onTimelineEvents).not.toHaveBeenCalled();
            expect(sink.onStateEvents).not.toHaveBeenCalled();

            backend.subscribeRoom(ROOM_ID, { timelineEventTypes: [EventType.RoomMessage], stateEventTypes: [] }, sink);
            backend.dispose();
            await room.addLiveEvents([mkMessage("later")], { addToState: true });
            expect(sink.onTimelineEvents).not.toHaveBeenCalled();
        });

        it("rejects unknown rooms", () => {
            expect(() =>
                backend.subscribeRoom("!other:example.org", { timelineEventTypes: [], stateEventTypes: [] }, sink),
            ).toThrow(FakeBackendFailed);
        });
    });
});
