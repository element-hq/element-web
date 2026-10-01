/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { type MatrixClient, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { mkRoomMemberJoinEvent, mkThirdPartyInviteEvent, stubClient } from "test-utils";

import DMRoomMap from "../DMRoomMap";
import { shouldEncryptRoomWithSingle3rdPartyInvite } from "./shouldEncryptRoomWithSingle3rdPartyInvite";
import { privateShouldBeEncrypted } from "../rooms";

vi.mock("../rooms", () => ({
    privateShouldBeEncrypted: vi.fn(),
}));

describe("shouldEncryptRoomWithSingle3rdPartyInvite", () => {
    let client: MatrixClient;
    let thirdPartyInviteEvent: MatrixEvent;
    let roomWithOneThirdPartyInvite: Room;

    beforeAll(() => {
        client = stubClient();
        DMRoomMap.makeShared(client);
    });

    beforeEach(() => {
        roomWithOneThirdPartyInvite = new Room("!room1:example.com", client, client.getSafeUserId());
        thirdPartyInviteEvent = mkThirdPartyInviteEvent(
            client.getSafeUserId(),
            "user@example.com",
            roomWithOneThirdPartyInvite.roomId,
        );

        roomWithOneThirdPartyInvite.currentState.setStateEvents([
            mkRoomMemberJoinEvent(client.getSafeUserId(), roomWithOneThirdPartyInvite.roomId),
            thirdPartyInviteEvent,
        ]);
        vi.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([roomWithOneThirdPartyInvite.roomId]));
    });

    describe("when well-known promotes encryption", () => {
        beforeEach(() => {
            vi.mocked(privateShouldBeEncrypted).mockReturnValue(true);
        });

        it("should return true + invite event for a DM room with one third-party invite", () => {
            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: true,
                inviteEvent: thirdPartyInviteEvent,
            });
        });

        it("should return false for a non-DM room with one third-party invite", () => {
            vi.mocked(DMRoomMap.shared().getRoomIds).mockReturnValue(new Set());

            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: false,
            });
        });

        it("should return false for a DM room with two members", () => {
            roomWithOneThirdPartyInvite.currentState.setStateEvents([
                mkRoomMemberJoinEvent("@user2:example.com", roomWithOneThirdPartyInvite.roomId),
            ]);

            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: false,
            });
        });

        it("should return false for a DM room with two third-party invites", () => {
            roomWithOneThirdPartyInvite.currentState.setStateEvents([
                mkThirdPartyInviteEvent(
                    client.getSafeUserId(),
                    "user2@example.com",
                    roomWithOneThirdPartyInvite.roomId,
                ),
            ]);

            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: false,
            });
        });
    });

    describe("when well-known does not promote encryption", () => {
        beforeEach(() => {
            vi.mocked(privateShouldBeEncrypted).mockReturnValue(false);
        });

        it("should return false for a DM room with one third-party invite", () => {
            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: false,
            });
        });
    });
});
