/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { type Room, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { useRedactMessagesButtonViewModel } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel";
import Modal from "../../../../../../../src/Modal";
import BulkRedactDialog from "../../../../../../../src/components/views/dialogs/BulkRedactDialog";
import { withClientContextRenderOptions } from "../../../../../../test-utils";

describe("useRedactMessagesButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    beforeEach(() => {
        mockRoom = mocked({
            roomId: defaultRoomId,
            getType: jest.fn().mockReturnValue(undefined),
            isSpaceRoom: jest.fn().mockReturnValue(false),
            getMember: jest.fn().mockReturnValue(undefined),
            getMxcAvatarUrl: jest.fn().mockReturnValue("mock-avatar-url"),
            name: "test room",
            on: jest.fn(),
            off: jest.fn(),
            currentState: {
                getStateEvents: jest.fn(),
                on: jest.fn(),
                off: jest.fn(),
            },
            getEventReadUpTo: jest.fn(),
        } as unknown as Room);

        mockClient = mocked({
            getUser: jest.fn(),
            isGuest: jest.fn().mockReturnValue(false),
            isUserIgnored: jest.fn(),
            getIgnoredUsers: jest.fn(),
            setIgnoredUsers: jest.fn(),
            getUserId: jest.fn().mockReturnValue(defaultUserId),
            getSafeUserId: jest.fn(),
            getDomain: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            isSynapseAdministrator: jest.fn().mockResolvedValue(false),
            doesServerSupportUnstableFeature: jest.fn().mockReturnValue(false),
            doesServerSupportExtendedProfiles: jest.fn().mockResolvedValue(false),
            getExtendedProfileProperty: jest.fn().mockRejectedValue(new Error("Not supported")),
            mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
            removeListener: jest.fn(),
            currentState: {
                on: jest.fn(),
            },
            getRoom: jest.fn(),
            credentials: {},
            setPowerLevel: jest.fn(),
        } as unknown as MatrixClient);

        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    const renderRedactButtonHook = (props = defaultMember) => {
        return renderHook(() => useRedactMessagesButtonViewModel(props), withClientContextRenderOptions(mockClient));
    };

    it("should show BulkRedactDialog upon clicking the Remove messages button", async () => {
        const spy = jest.spyOn(Modal, "createDialog");

        mockClient.getRoom.mockReturnValue(mockRoom);
        mockClient.getUserId.mockReturnValue("@arbitraryId:server");
        const mockMeMember = new RoomMember(mockRoom.roomId, mockClient.getUserId()!);
        mockMeMember.powerLevel = 51; // defaults to 50
        const defaultMemberWithPowerLevel = { ...defaultMember, powerLevel: 0 } as RoomMember;
        mockRoom.getMember.mockImplementation((userId) =>
            userId === mockClient.getUserId() ? mockMeMember : defaultMemberWithPowerLevel,
        );

        const { result } = renderRedactButtonHook();
        await result.current.onRedactAllMessagesClick();

        expect(spy).toHaveBeenCalledWith(
            BulkRedactDialog,
            expect.objectContaining({ member: defaultMemberWithPowerLevel }),
        );
    });
});
