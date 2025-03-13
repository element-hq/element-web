/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { setDMRoom } from "../../src/Rooms";
import { mkEvent, stubClient } from "../test-utils";

describe("setDMRoom", () => {
    const userId1 = "@user1:example.com";
    const userId2 = "@user2:example.com";
    const userId3 = "@user3:example.com";
    const roomId1 = "!room1:example.com";
    const roomId2 = "!room2:example.com";
    const roomId3 = "!room3:example.com";
    const roomId4 = "!room4:example.com";
    let client: MatrixClient;

    beforeEach(() => {
        client = mocked(stubClient());
        client.getAccountData = jest.fn().mockImplementation((eventType: string): MatrixEvent | undefined => {
            if (eventType === EventType.Direct) {
                return mkEvent({
                    event: true,
                    content: {
                        [userId1]: [roomId1, roomId2],
                        [userId2]: [roomId3],
                    },
                    type: EventType.Direct,
                    user: client.getSafeUserId(),
                });
            }

            return undefined;
        });
    });

    describe("when logged in as a guest and marking a room as DM", () => {
        beforeEach(() => {
            mocked(client.isGuest).mockReturnValue(true);
            setDMRoom(client, roomId1, userId1);
        });

        it("should not update the account data", () => {
            expect(client.setAccountData).not.toHaveBeenCalled();
        });
    });

    describe("when adding a new room to an existing DM relation", () => {
        beforeEach(() => {
            setDMRoom(client, roomId4, userId1);
        });

        it("should update the account data accordingly", () => {
            expect(client.setAccountData).toHaveBeenCalledWith(EventType.Direct, {
                [userId1]: [roomId1, roomId2, roomId4],
                [userId2]: [roomId3],
            });
        });
    });

    describe("when adding a new DM room", () => {
        beforeEach(() => {
            setDMRoom(client, roomId4, userId3);
        });

        it("should update the account data accordingly", () => {
            expect(client.setAccountData).toHaveBeenCalledWith(EventType.Direct, {
                [userId1]: [roomId1, roomId2],
                [userId2]: [roomId3],
                [userId3]: [roomId4],
            });
        });
    });

    describe("when trying to add a DM, that already exists", () => {
        beforeEach(() => {
            setDMRoom(client, roomId1, userId1);
        });

        it("should not update the account data", () => {
            expect(client.setAccountData).not.toHaveBeenCalled();
        });
    });

    describe("when removing an existing DM", () => {
        beforeEach(() => {
            setDMRoom(client, roomId1, null);
        });

        it("should update the account data accordingly", () => {
            expect(client.setAccountData).toHaveBeenCalledWith(EventType.Direct, {
                [userId1]: [roomId2],
                [userId2]: [roomId3],
            });
        });
    });

    describe("when removing an unknown room", () => {
        beforeEach(() => {
            setDMRoom(client, roomId4, null);
        });

        it("should not update the account data", () => {
            expect(client.setAccountData).not.toHaveBeenCalled();
        });
    });

    describe("when the direct event is undefined", () => {
        beforeEach(() => {
            mocked(client.getAccountData).mockReturnValue(undefined);
            setDMRoom(client, roomId1, userId1);
        });

        it("should update the account data accordingly", () => {
            expect(client.setAccountData).toHaveBeenCalledWith(EventType.Direct, {
                [userId1]: [roomId1],
            });
        });
    });

    describe("when the current content is undefined", () => {
        beforeEach(() => {
            // @ts-ignore
            mocked(client.getAccountData).mockReturnValue({
                getContent: jest.fn(),
            });
            setDMRoom(client, roomId1, userId1);
        });

        it("should update the account data accordingly", () => {
            expect(client.setAccountData).toHaveBeenCalledWith(EventType.Direct, {
                [userId1]: [roomId1],
            });
        });
    });
});
