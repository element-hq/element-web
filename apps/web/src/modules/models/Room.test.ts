/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { EventType, JoinRule, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent, mkRoom, stubClient } from "test-utils";

import { Room } from "./Room";
import { canInviteTo } from "../../utils/room/canInviteTo";

vi.mock("../../utils/room/canInviteTo", () => ({ canInviteTo: vi.fn() }));

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

    it("should return a shareable permalink for the sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        expect(room.getPermalink()).toStrictEqual("https://matrix.to/#/!foo:m.org");
    });

    it("should send a join rules state event when setting the join rule", async () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        await room.setJoinRule("knock");
        expect(cli.sendStateEvent).toHaveBeenCalledWith("!foo:m.org", EventType.RoomJoinRules, { join_rule: "knock" });
    });

    it("should use the host invite check to tell whether the user can invite", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        vi.mocked(canInviteTo).mockReturnValue(false);
        const room = new Room(sdkRoom);
        expect(room.canInvite()).toStrictEqual(false);
        expect(canInviteTo).toHaveBeenCalledWith(sdkRoom);
    });

    it("should return whether the user can send a join rules event", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        vi.mocked(sdkRoom.currentState.maySendStateEvent).mockReturnValue(false);
        const room = new Room(sdkRoom);
        expect(room.canChangeJoinRule()).toStrictEqual(false);
        expect(sdkRoom.currentState.maySendStateEvent).toHaveBeenCalledWith(
            EventType.RoomJoinRules,
            cli.getSafeUserId(),
        );
    });

    it.each([
        ["6", false],
        ["7", true],
        ["10", true],
    ])("should return whether room version %s supports knocking", (version, expected) => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        vi.mocked(sdkRoom.getVersion).mockReturnValue(version);
        const room = new Room(sdkRoom);
        expect(room.supportsKnock()).toStrictEqual(expected);
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

    describe("watchableJoinRule", () => {
        it("should return join rule from sdkRoom", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.getJoinRule.mockReturnValue(JoinRule.Public);
            const room = new Room(sdkRoom);
            expect(room.joinRule.value).toStrictEqual("public");
        });

        it("should update when the join rule changes", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.getJoinRule.mockReturnValue(JoinRule.Public);

            const room = new Room(sdkRoom);
            const fn = vi.fn();

            // Changed while nobody was watching
            sdkRoom.getJoinRule.mockReturnValue(JoinRule.Knock);
            room.joinRule.watch(fn);
            expect(room.joinRule.value).toStrictEqual("knock");

            sdkRoom.getJoinRule.mockReturnValue(JoinRule.Invite);
            const mkStateEvent = (type: string): ReturnType<typeof mkEvent> =>
                mkEvent({ event: true, type, room: sdkRoom.roomId, user: "@alice:m.org", skey: "", content: {} });

            // Other state events are ignored
            sdkRoom.emit(RoomStateEvent.Events, mkStateEvent(EventType.RoomTopic), sdkRoom.currentState, null);
            expect(fn).not.toHaveBeenCalled();

            sdkRoom.emit(RoomStateEvent.Events, mkStateEvent(EventType.RoomJoinRules), sdkRoom.currentState, null);
            expect(room.joinRule.value).toStrictEqual("invite");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should add/remove event listener on sdk room", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");

            const room = new Room(sdkRoom);
            const fn = vi.fn();
            const onSpy = vi.spyOn(sdkRoom, "on");
            const offSpy = vi.spyOn(sdkRoom, "off");

            room.joinRule.watch(fn);
            expect(onSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));

            room.joinRule.unwatch(fn);
            expect(offSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));
        });
    });
});
