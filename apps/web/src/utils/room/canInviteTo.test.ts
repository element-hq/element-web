/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { JoinRule, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "test-utils";

import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import { canInviteTo } from "./canInviteTo";

vi.mock("../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

describe("canInviteTo()", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const makeRoom = (): Room => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
        });
        const room = new Room(roomId, client, userId);
        vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        vi.spyOn(room, "canInvite").mockReturnValue(true);
        return room;
    };

    beforeEach(() => {
        vi.mocked(shouldShowComponent).mockReturnValue(true);
    });

    describe("when user has permissions to issue an invite for this room", () => {
        // aka when Room.canInvite is true

        it("should return false when current user membership is not joined", () => {
            const room = makeRoom();
            vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return false when UIComponent.InviteUsers customisation hides invite", () => {
            const room = makeRoom();
            vi.mocked(shouldShowComponent).mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(false);
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        });

        it("should return true when user can invite and is a room member", () => {
            const room = makeRoom();

            expect(canInviteTo(room)).toEqual(true);
        });
    });

    describe("when user does not have permissions to issue an invite for this room", () => {
        // aka when Room.canInvite is false

        it("should return false when room is a private space", () => {
            const room = makeRoom();
            vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
            vi.spyOn(room, "isSpaceRoom").mockReturnValue(true);
            vi.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return false when room is just a room", () => {
            const room = makeRoom();
            vi.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return true when room is a public space", () => {
            const room = makeRoom();
            // default join rule is public
            vi.spyOn(room, "isSpaceRoom").mockReturnValue(true);
            vi.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(true);
        });
    });
});
