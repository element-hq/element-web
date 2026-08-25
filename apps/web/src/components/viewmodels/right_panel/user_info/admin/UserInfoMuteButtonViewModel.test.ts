/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import {
    type Room,
    type MatrixClient,
    RoomMember,
    type MatrixEvent,
    type ISendEventResponse,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { renderHook } from "test-utils-rtl";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { type RoomAdminToolsProps } from "./UserInfoAdminToolsContainerViewModel";
import { useMuteButtonViewModel } from "./UserInfoMuteButtonViewModel";

describe("useMuteButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    let defaultAdminToolsProps: RoomAdminToolsProps;

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

        defaultAdminToolsProps = {
            room: mockRoom,
            member: defaultMember,
            isUpdating: false,
            startUpdating: vi.fn(),
            stopUpdating: vi.fn(),
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

        mockClient.setPowerLevel.mockImplementation(() => Promise.resolve({} as ISendEventResponse));

        vi.mocked(mockRoom.currentState.getStateEvents).mockReturnValueOnce({
            getContent: vi.fn().mockReturnValue({
                events: {
                    "m.room.message": 0,
                },
                events_default: 0,
            }),
        } as unknown as MatrixEvent);

        vi.spyOn(mockClient, "setPowerLevel").mockImplementation(() => Promise.resolve({} as ISendEventResponse));
        vi.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValue({
            getContent: vi.fn().mockReturnValue({
                events: {
                    "m.room.message": 0,
                },
                events_default: 0,
            }),
        } as unknown as MatrixEvent);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const renderMuteButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useMuteButtonViewModel(props), withClientContextRenderOptions(mockClient));
    };

    it("should early return when isUpdating=true", async () => {
        const defaultMemberWithPowerLevelAndJoinMembership = {
            ...defaultMember,
            powerLevel: 0,
            membership: KnownMembership.Join,
        } as RoomMember;

        const { result } = renderMuteButtonHook({
            ...defaultAdminToolsProps,
            member: defaultMemberWithPowerLevelAndJoinMembership,
            isUpdating: true,
        });

        const resultClick = await result.current.onMuteButtonClick();

        expect(resultClick).toBe(undefined);
    });

    it("should stop updating when level is NaN", async () => {
        const { result } = renderMuteButtonHook({
            ...defaultAdminToolsProps,
            member: defaultMember,
            isUpdating: false,
        });

        vi.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValueOnce({
            getContent: vi.fn().mockReturnValue({
                events: {
                    "m.room.message": NaN,
                },
                events_default: NaN,
            }),
        } as unknown as MatrixEvent);

        await result.current.onMuteButtonClick();

        expect(defaultAdminToolsProps.stopUpdating).toHaveBeenCalled();
    });

    it("should set powerlevel to default when user is muted", async () => {
        const defaultMutedMember = {
            ...defaultMember,
            powerLevel: -1,
            membership: KnownMembership.Join,
        } as RoomMember;

        const { result } = renderMuteButtonHook({
            ...defaultAdminToolsProps,
            member: defaultMutedMember,
            isUpdating: false,
        });

        await result.current.onMuteButtonClick();

        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, 0);
    });

    it("should set powerlevel - 1 when user is unmuted", async () => {
        const defaultUnmutedMember = {
            ...defaultMember,
            powerLevel: 0,
            membership: KnownMembership.Join,
        } as RoomMember;

        const { result } = renderMuteButtonHook({
            ...defaultAdminToolsProps,
            member: defaultUnmutedMember,
            isUpdating: false,
        });

        await result.current.onMuteButtonClick();

        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, -1);
    });
});
