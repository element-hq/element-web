/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, JoinRule, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import shouldHideEvent from "../../src/shouldHideEvent";
import { getMockClientWithEventEmitter, mockClientMethodsUser, mkEvent, mkMembership } from "../test-utils";

describe("shouldHideEvent", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    let client: ReturnType<typeof getMockClientWithEventEmitter>;

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            getRoom: jest.fn(),
        });
    });

    function makeRoomWithJoinRule(joinRule: JoinRule): Room {
        const room = new Room(roomId, client, userId);
        jest.spyOn(room, "getJoinRule").mockReturnValue(joinRule);
        client.getRoom.mockReturnValue(room);
        return room;
    }

    describe("member events in invite-only rooms", () => {
        beforeEach(() => {
            makeRoomWithJoinRule(JoinRule.Invite);
        });

        it("hides join events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Leave,
            });
            expect(shouldHideEvent(event)).toBe(true);
        });

        it("hides leave events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Leave,
                prevMship: KnownMembership.Join,
            });
            expect(shouldHideEvent(event)).toBe(true);
        });

        it("hides avatar change events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "Alice",
                url: "mxc://new_avatar",
            });
            expect(shouldHideEvent(event)).toBe(true);
        });

        it("hides displayname change events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "New Alice",
            });
            expect(shouldHideEvent(event)).toBe(true);
        });
    });

    describe("member events in public rooms", () => {
        beforeEach(() => {
            makeRoomWithJoinRule(JoinRule.Public);
        });

        it("does not hide join events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Leave,
            });
            expect(shouldHideEvent(event)).toBe(false);
        });

        it("does not hide leave events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Leave,
                prevMship: KnownMembership.Join,
            });
            expect(shouldHideEvent(event)).toBe(false);
        });

        it("does not hide avatar change events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "Alice",
                url: "mxc://new_avatar",
            });
            expect(shouldHideEvent(event)).toBe(false);
        });

        it("does not hide displayname change events", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "New Alice",
            });
            expect(shouldHideEvent(event)).toBe(false);
        });
    });

    describe("member events in knockable rooms", () => {
        beforeEach(() => {
            makeRoomWithJoinRule(JoinRule.Knock);
        });

        it("does not hide join events in knock rooms", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Leave,
            });
            expect(shouldHideEvent(event)).toBe(false);
        });
    });

    describe("when client returns no room", () => {
        beforeEach(() => {
            client.getRoom.mockReturnValue(null);
        });

        it("does not hide member events when room is not found", () => {
            const event = mkMembership({
                event: true,
                room: roomId,
                user: userId,
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Leave,
            });
            expect(shouldHideEvent(event)).toBe(false);
        });

        it("does not hide non-member events when room is not found", () => {
            const event = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: userId,
                room: roomId,
                content: { msgtype: "m.text", body: "hello" },
            });
            expect(shouldHideEvent(event)).toBe(false);
        });
    });
});
