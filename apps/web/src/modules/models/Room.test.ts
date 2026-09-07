/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, vi, expect } from "vitest";
import { RoomStateEvent, type RoomState } from "matrix-js-sdk/src/matrix";

import { Room } from "./Room";
import { mkEvent, mkRoom, stubClient } from "test-utils";

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
    });

    it("should return whether the room is encrypted", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        vi.spyOn(sdkRoom, "hasEncryptionStateEvent").mockReturnValue(true);
        const room = new Room(sdkRoom);
        expect(room.isEncrypted()).toBe(true);
    });

    it("should return state event watchable", async () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const event = mkEvent({
            skey: "",
            type: "m.foo.bar",
            user: "@alice:m.org",
            content: {
                foo: "bar",
            },
            room: "!my-room:m.org",
            event: true,
            id: "my-state-event",
        });
        vi.spyOn(sdkRoom, "currentState", "get").mockReturnValue({
            getStateEvents: vi.fn().mockReturnValue(event),
        } as unknown as RoomState);

        const room = new Room(sdkRoom);
        const watchable = room.getStateEvent("m.foo.bar");
        const fn = vi.fn();
        watchable.watch(fn);
        expect(watchable.value?.eventId).toStrictEqual("my-state-event");

        // Watchable should update with new event
        const updatedEvent = mkEvent({
            skey: "",
            type: "m.foo.bar",
            user: "@alice:m.org",
            content: {
                foo: "test",
            },
            room: "!my-room:m.org",
            event: true,
            id: "my-updated-state",
        });
        sdkRoom.emit(RoomStateEvent.Events, updatedEvent);
        await vi.waitFor(() => {
            expect(watchable.value?.eventId).toStrictEqual("my-updated-state");
        });
    });

    it("should return event from timeline", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const event = mkEvent({
            type: "m.room.message",
            user: "@alice:m.org",
            content: {
                foo: "bar",
            },
            room: "!my-room:m.org",
            event: true,
            id: "my-timeline-event",
        });
        const spy = vi.spyOn(sdkRoom, "findEventById").mockReturnValue(event);

        const room = new Room(sdkRoom);
        expect(room.findEventById("my-timeline-event")?.eventId).toStrictEqual("my-timeline-event");
        expect(spy).toHaveBeenCalledWith("my-timeline-event");
    });
});
