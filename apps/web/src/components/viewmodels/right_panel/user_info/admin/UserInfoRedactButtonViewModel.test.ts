/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { type Room, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { renderHook } from "test-utils-rtl";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { useRedactMessagesButtonViewModel } from "./UserInfoRedactButtonViewModel";
import Modal from "../../../../../Modal";
import BulkRedactDialog from "../../../../views/dialogs/BulkRedactDialog";

describe("useRedactMessagesButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    beforeEach(() => {
        mockRoom = vi.mocked({
            roomId: defaultRoomId,
            getType: vi.fn().mockReturnValue(undefined),
            isSpaceRoom: vi.fn().mockReturnValue(false),
            getMember: vi.fn().mockReturnValue(undefined),
            getMxcAvatarUrl: vi.fn().mockReturnValue("mock-avatar-url"),
            name: "test room",
            on: vi.fn(),
            off: vi.fn(),
            currentState: {
                getStateEvents: vi.fn(),
                on: vi.fn(),
                off: vi.fn(),
            },
            getEventReadUpTo: vi.fn(),
        } as unknown as Room);

        mockClient = vi.mocked({
            getUser: vi.fn(),
            isGuest: vi.fn().mockReturnValue(false),
            isUserIgnored: vi.fn(),
            getIgnoredUsers: vi.fn(),
            setIgnoredUsers: vi.fn(),
            getUserId: vi.fn().mockReturnValue(defaultUserId),
            getSafeUserId: vi.fn(),
            getDomain: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            isSynapseAdministrator: vi.fn().mockResolvedValue(false),
            doesServerSupportUnstableFeature: vi.fn().mockReturnValue(false),
            doesServerSupportExtendedProfiles: vi.fn().mockResolvedValue(false),
            getExtendedProfileProperty: vi.fn().mockRejectedValue(new Error("Not supported")),
            mxcUrlToHttp: vi.fn().mockReturnValue("mock-mxcUrlToHttp"),
            removeListener: vi.fn(),
            currentState: {
                on: vi.fn(),
            },
            getRoom: vi.fn(),
            credentials: {},
            setPowerLevel: vi.fn(),
        } as unknown as MatrixClient);

        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    const renderRedactButtonHook = (props = defaultMember) => {
        return renderHook(() => useRedactMessagesButtonViewModel(props), withClientContextRenderOptions(mockClient));
    };

    it("should show BulkRedactDialog upon clicking the Remove messages button", async () => {
        const spy = vi.spyOn(Modal, "createDialog");

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
