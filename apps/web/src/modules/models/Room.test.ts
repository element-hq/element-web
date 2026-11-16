/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { EventType, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent, mkRoom, stubClient } from "test-utils";

import { Room } from "./Room";

describe("Room", () => {
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

        it("should refresh the name when first watched", () => {
            const sdkRoom = mkRoom(stubClient(), "!foo:m.org");
            sdkRoom.name = "Initial name";
            const room = new Room(sdkRoom);
            const listener = vi.fn();
            sdkRoom.name = "Updated name";

            room.name.watch(listener);

            expect(listener).toHaveBeenCalledExactlyOnceWith("Updated name");
            room.name.unwatch(listener);
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
