/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Room } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter } from "test-utils";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { inviteToRoom } from "./inviteToRoom";

describe("inviteToRoom()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const makeRoom = (): Room => {
        const client = getMockClientWithEventEmitter({
            isGuest: vi.fn(),
        });
        const room = new Room(roomId, client, userId);
        return room;
    };

    beforeEach(() => {
        // stub
        vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("requires registration when a guest tries to invite to a room", () => {
        const room = makeRoom();

        vi.spyOn(room.client, "isGuest").mockReturnValue(true);

        inviteToRoom(room);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
    });

    it("opens the room inviter", () => {
        const room = makeRoom();

        vi.spyOn(room.client, "isGuest").mockReturnValue(false);

        inviteToRoom(room);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "view_invite", roomId });
    });
});
