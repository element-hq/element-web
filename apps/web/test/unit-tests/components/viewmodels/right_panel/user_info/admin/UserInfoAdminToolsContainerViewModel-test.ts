/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { type Room, type MatrixClient, RoomMember, type IPowerLevelsContent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import {
    type RoomAdminToolsContainerProps,
    useUserInfoAdminToolsContainerViewModel,
} from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { withClientContextRenderOptions } from "../../../../../../test-utils";

describe("UserInfoAdminToolsContainerViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;
    let mockPowerLevels: IPowerLevelsContent;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    let defaultContainerProps: RoomAdminToolsContainerProps;

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

        mockPowerLevels = {
            users: {
                "@currentuser:example.com": 100,
            },
            events: {},
            state_default: 50,
            ban: 50,
            kick: 50,
            redact: 50,
        };

        defaultContainerProps = {
            room: mockRoom,
            member: defaultMember,
            powerLevels: mockPowerLevels,
        };

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

    const renderAdminToolsContainerHook = (props = defaultContainerProps) => {
        return renderHook(
            () => useUserInfoAdminToolsContainerViewModel(props),
            withClientContextRenderOptions(mockClient),
        );
    };

    describe("useUserInfoAdminToolsContainerViewModel", () => {
        it("should return false when user is not in the room", () => {
            mockRoom.getMember.mockReturnValue(null);
            const { result } = renderAdminToolsContainerHook();
            expect(result.current).toEqual({
                isCurrentUserInTheRoom: false,
                shouldShowKickButton: false,
                shouldShowBanButton: false,
                shouldShowMuteButton: false,
                shouldShowRedactButton: false,
            });
        });

        it("should not show kick, ban and mute buttons if user is me", () => {
            const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
            mockMeMember.powerLevel = 51; // defaults to 50
            mockRoom.getMember.mockReturnValueOnce(mockMeMember);

            const props = {
                ...defaultContainerProps,
                room: mockRoom,
                member: mockMeMember,
                powerLevels: mockPowerLevels,
            };
            const { result } = renderAdminToolsContainerHook(props);

            expect(result.current).toEqual({
                isCurrentUserInTheRoom: true,
                shouldShowKickButton: false,
                shouldShowBanButton: false,
                shouldShowMuteButton: false,
                shouldShowRedactButton: true,
            });
        });

        it("returns mute toggle button if conditions met", () => {
            const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
            mockMeMember.powerLevel = 51; // defaults to 50
            mockRoom.getMember.mockReturnValueOnce(mockMeMember);

            const defaultMemberWithPowerLevelAndJoinMembership = {
                ...defaultMember,
                powerLevel: 0,
                membership: KnownMembership.Join,
            } as RoomMember;

            const { result } = renderAdminToolsContainerHook({
                ...defaultContainerProps,
                member: defaultMemberWithPowerLevelAndJoinMembership,
                powerLevels: { events: { "m.room.power_levels": 1 } },
            });

            expect(result.current.shouldShowMuteButton).toBe(true);
        });

        it("should not show mute button for one's own member", () => {
            const mockMeMember = new RoomMember(mockRoom.roomId, mockClient.getSafeUserId());
            mockMeMember.powerLevel = 51; // defaults to 50
            mockRoom.getMember.mockReturnValueOnce(mockMeMember);
            mockClient.getUserId.mockReturnValueOnce(mockMeMember.userId);

            const { result } = renderAdminToolsContainerHook({
                ...defaultContainerProps,
                member: mockMeMember,
                powerLevels: { events: { "m.room.power_levels": 100 } },
            });

            expect(result.current.shouldShowMuteButton).toBe(false);
        });
    });
});
