/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { type Room, type MatrixClient, RoomMember, type IPowerLevelsContent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { renderHook } from "test-utils-rtl";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import {
    type RoomAdminToolsContainerProps,
    useUserInfoAdminToolsContainerViewModel,
} from "./UserInfoAdminToolsContainerViewModel";

describe("UserInfoAdminToolsContainerViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;
    let mockPowerLevels: IPowerLevelsContent;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    let defaultContainerProps: RoomAdminToolsContainerProps;

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
