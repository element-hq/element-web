/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { JoinRule, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { shouldShowComponent } from "../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../src/settings/UIFeature";
import { canInviteTo } from "../../../../src/utils/room/canInviteTo";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";

jest.mock("../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("canInviteTo()", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const makeRoom = (): Room => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
        });
        const room = new Room(roomId, client, userId);
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        return room;
    };

    beforeEach(() => {
        mocked(shouldShowComponent).mockReturnValue(true);
    });

    describe("when user has permissions to issue an invite for this room", () => {
        // aka when Room.canInvite is true

        it("should return false when current user membership is not joined", () => {
            const room = makeRoom();
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return false when UIComponent.InviteUsers customisation hides invite", () => {
            const room = makeRoom();
            mocked(shouldShowComponent).mockReturnValue(false);

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
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
            jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);
            jest.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return false when room is just a room", () => {
            const room = makeRoom();
            jest.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(false);
        });

        it("should return true when room is a public space", () => {
            const room = makeRoom();
            // default join rule is public
            jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);
            jest.spyOn(room, "canInvite").mockReturnValue(false);

            expect(canInviteTo(room)).toEqual(true);
        });
    });
});
