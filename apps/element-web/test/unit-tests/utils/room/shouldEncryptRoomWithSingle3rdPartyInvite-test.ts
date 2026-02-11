/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { shouldEncryptRoomWithSingle3rdPartyInvite } from "../../../../src/utils/room/shouldEncryptRoomWithSingle3rdPartyInvite";
import { privateShouldBeEncrypted } from "../../../../src/utils/rooms";
import { mkRoomMemberJoinEvent, mkThirdPartyInviteEvent, stubClient } from "../../../test-utils";

jest.mock("../../../../src/utils/rooms", () => ({
    privateShouldBeEncrypted: jest.fn(),
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
        jest.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([roomWithOneThirdPartyInvite.roomId]));
    });

    describe("when well-known promotes encryption", () => {
        beforeEach(() => {
            mocked(privateShouldBeEncrypted).mockReturnValue(true);
        });

        it("should return true + invite event for a DM room with one third-party invite", () => {
            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: true,
                inviteEvent: thirdPartyInviteEvent,
            });
        });

        it("should return false for a non-DM room with one third-party invite", () => {
            mocked(DMRoomMap.shared().getRoomIds).mockReturnValue(new Set());

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
            mocked(privateShouldBeEncrypted).mockReturnValue(false);
        });

        it("should return false for a DM room with one third-party invite", () => {
            expect(shouldEncryptRoomWithSingle3rdPartyInvite(roomWithOneThirdPartyInvite)).toEqual({
                shouldEncrypt: false,
            });
        });
    });
});
