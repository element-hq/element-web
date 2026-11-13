/*
 * Copyright 2025-2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { EventType, RoomStateEvent, type RoomState } from "matrix-js-sdk/src/matrix";
import { mkEvent, mkRoom, stubClient } from "test-utils";

import { Room } from "./Room";

describe("Room", () => {
    describe("getStateEvents", () => {
        it("returns detached current snapshots and keeps the same watchable per type", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            const sourceEvent = mkEvent({
                event: true,
                type: "com.example.config",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { nested: { value: "original" } },
                skey: "",
            });
            const disabledEvent = mkEvent({
                event: true,
                type: "com.example.config",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { disabled: true },
                skey: "second-connection",
            });
            const state = {
                getStateEvents: vi.fn().mockReturnValue([sourceEvent, disabledEvent]),
            } as unknown as RoomState;
            vi.spyOn(sdkRoom.getLiveTimeline(), "getState").mockReturnValue(state);
            const room = new Room(sdkRoom);
            const watchable = room.getStateEvents("com.example.config");

            expect(room.getStateEvents("com.example.config")).toBe(watchable);
            expect(watchable.value).toEqual([
                { stateKey: "", content: { nested: { value: "original" } } },
                { stateKey: "second-connection", content: { disabled: true } },
            ]);
            (watchable.value[0].content.nested as Record<string, unknown>).value = "module edit";
            expect(sourceEvent.getContent().nested).toEqual({ value: "original" });
        });

        it("updates on relevant live state changes and removes its listener after the last unwatch", async () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            let currentEvents: ReturnType<typeof mkEvent>[] = [];
            const state = { getStateEvents: vi.fn(() => currentEvents) } as unknown as RoomState;
            vi.spyOn(sdkRoom.getLiveTimeline(), "getState").mockReturnValue(state);
            const room = new Room(sdkRoom);
            const watchable = room.getStateEvents("com.example.config");
            const listener = vi.fn();
            const onSpy = vi.spyOn(sdkRoom, "on");
            const offSpy = vi.spyOn(sdkRoom, "off");
            watchable.watch(listener);

            const event = mkEvent({
                event: true,
                type: "com.example.config",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { enabled: true },
                skey: "connection",
            });
            currentEvents = [event];
            sdkRoom.emit(RoomStateEvent.Events, event, state, null);
            expect(listener).toHaveBeenCalledWith([{ stateKey: "connection", content: { enabled: true } }]);

            const unrelated = mkEvent({
                event: true,
                type: "com.example.other",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: {},
                skey: "",
            });
            sdkRoom.emit(RoomStateEvent.Events, unrelated, state, null);
            expect(listener).toHaveBeenCalledTimes(1);

            const identical = mkEvent({
                event: true,
                type: "com.example.config",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { enabled: true },
                skey: "connection",
            });
            sdkRoom.emit(RoomStateEvent.Events, identical, state, null);
            const otherRoomEvent = mkEvent({
                event: true,
                type: "com.example.config",
                room: "!other:m.org",
                user: "@a:m.org",
                content: { enabled: false },
                skey: "connection",
            });
            sdkRoom.emit(RoomStateEvent.Events, otherRoomEvent, state, null);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(onSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));

            watchable.unwatch(listener);
            expect(offSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));

            currentEvents = [
                mkEvent({
                    event: true,
                    type: "com.example.config",
                    room: sdkRoom.roomId,
                    user: "@a:m.org",
                    content: { enabled: false },
                    skey: "connection",
                }),
            ];
            watchable.watch(listener);
            await vi.waitFor(() =>
                expect(listener).toHaveBeenLastCalledWith([{ stateKey: "connection", content: { enabled: false } }]),
            );
            watchable.unwatch(listener);
        });

        it("starts empty when the requested type is absent", () => {
            const sdkRoom = mkRoom(stubClient(), "!foo:m.org");
            expect(new Room(sdkRoom).getStateEvents("com.example.missing").value).toEqual([]);
        });

        it("clears state on leave and refreshes it again after rejoin", () => {
            const sdkRoom = mkRoom(stubClient(), "!foo:m.org");
            let membership: ReturnType<typeof sdkRoom.getMyMembership> = "join";
            vi.spyOn(sdkRoom, "getMyMembership").mockImplementation(() => membership);
            const connection = mkEvent({
                event: true,
                type: "com.example.config",
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { enabled: true },
                skey: "connection",
            });
            const state = { getStateEvents: vi.fn().mockReturnValue([connection]) } as unknown as RoomState;
            vi.spyOn(sdkRoom.getLiveTimeline(), "getState").mockReturnValue(state);
            const watchable = new Room(sdkRoom).getStateEvents("com.example.config");
            const listener = vi.fn();
            watchable.watch(listener);

            membership = "leave";
            const leaveEvent = mkEvent({
                event: true,
                type: EventType.RoomMember,
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { membership: "leave" },
                skey: "@a:m.org",
            });
            sdkRoom.emit(RoomStateEvent.Events, leaveEvent, state, null);
            expect(listener).toHaveBeenLastCalledWith([]);

            membership = "join";
            const joinEvent = mkEvent({
                event: true,
                type: EventType.RoomMember,
                room: sdkRoom.roomId,
                user: "@a:m.org",
                content: { membership: "join" },
                skey: "@a:m.org",
            });
            sdkRoom.emit(RoomStateEvent.Events, joinEvent, state, null);
            expect(listener).toHaveBeenLastCalledWith([{ stateKey: "connection", content: { enabled: true } }]);
            watchable.unwatch(listener);
        });
    });

    it("should return id from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        expect(room.id).toStrictEqual("!foo:m.org");
    });

    it("should return last timestamp from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        expect(room.getLastActiveTimestamp()).toStrictEqual(sdkRoom.getLastActiveTimestamp());
    });

    describe("watchableName", () => {
        it("should return name from sdkRoom", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";
            const room = new Room(sdkRoom);
            expect(room.name.value).toStrictEqual("Foo Name");
        });

        it("should add/remove event listener on sdk room", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";

            const room = new Room(sdkRoom);
            const fn = vi.fn();
            const onSpy = vi.spyOn(sdkRoom, "on");
            const offSpy = vi.spyOn(sdkRoom, "off");

            room.name.watch(fn);
            expect(onSpy).toHaveBeenCalledTimes(1);

            room.name.unwatch(fn);
            expect(offSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("watchableIsEncrypted", () => {
        function setup(): {
            sdkRoom: ReturnType<typeof mkRoom>;
            room: Room;
            isEncryptionEnabledInRoom: ReturnType<typeof vi.fn>;
        } {
            const cli = stubClient();
            const isEncryptionEnabledInRoom = vi.fn().mockResolvedValue(true);
            vi.mocked(cli.getCrypto).mockReturnValue({ isEncryptionEnabledInRoom } as any);
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            return { sdkRoom, room: new Room(sdkRoom), isEncryptionEnabledInRoom };
        }

        it("should be undefined until the encryption status is determined", async () => {
            const { room, isEncryptionEnabledInRoom } = setup();

            let resolveFn: (value: boolean) => void;
            const encryptionEnabledPromise = new Promise<boolean>((r) => {
                resolveFn = r;
            });
            isEncryptionEnabledInRoom.mockReturnValue(encryptionEnabledPromise);

            expect(room.isEncrypted.value).toBe(undefined);
            resolveFn!(true);
            await vi.waitFor(() => expect(room.isEncrypted.value).toBe(true));
        });

        it("should use the crypto api once watched", async () => {
            const { room, isEncryptionEnabledInRoom } = setup();
            const fn = vi.fn();
            room.isEncrypted.watch(fn);

            await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(true));
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledWith("!foo:m.org");
            expect(room.isEncrypted.value).toBe(true);
        });

        it("should be false if there is no crypto api", async () => {
            const { sdkRoom, room } = setup();
            vi.mocked(sdkRoom.client.getCrypto).mockReturnValue(undefined);
            room.isEncrypted.watch(vi.fn());
            await Promise.resolve();
            expect(room.isEncrypted.value).toBe(false);
        });

        it("should recheck when the encryption state event changes", async () => {
            const { sdkRoom, room, isEncryptionEnabledInRoom } = setup();
            await vi.waitFor(() => expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(1));
            isEncryptionEnabledInRoom.mockResolvedValue(false);
            const fn = vi.fn();
            room.isEncrypted.watch(fn);
            await vi.waitFor(() => expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(2));

            // Other state events are ignored
            sdkRoom.emit(
                RoomStateEvent.Events,
                mkEvent({ event: true, type: EventType.RoomTopic, room: "!foo:m.org", user: "@a:m.org", content: {} }),
                sdkRoom.currentState,
                null,
            );
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(2);

            isEncryptionEnabledInRoom.mockResolvedValue(true);
            sdkRoom.emit(
                RoomStateEvent.Events,
                mkEvent({
                    event: true,
                    type: EventType.RoomEncryption,
                    room: "!foo:m.org",
                    user: "@a:m.org",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                    skey: "",
                }),
                sdkRoom.currentState,
                null,
            );
            await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(true));
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(3);
        });
    });
});
