/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, type Mocked, type Mock } from "vitest";
import { type Room, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { cleanup, renderHook } from "test-utils-rtl";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { type RoomAdminToolsProps } from "./UserInfoAdminToolsContainerViewModel";
import { useBanButtonViewModel } from "./UserInfoBanButtonViewModel";
import Modal from "../../../../../Modal";

describe("useBanButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockSpace: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const memberWithBanMembership = { ...defaultMember, membership: KnownMembership.Ban } as RoomMember;

    let defaultAdminToolsProps: RoomAdminToolsProps;
    const createDialogSpy: Mock = vi.spyOn(Modal, "createDialog") as unknown as Mock;

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

        mockSpace = vi.mocked({
            roomId: defaultRoomId,
            getType: vi.fn().mockReturnValue("m.space"),
            isSpaceRoom: vi.fn().mockReturnValue(true),
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
        mockRoom.getMember.mockReturnValue(defaultMember);
    });

    const renderBanButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useBanButtonViewModel(props), withClientContextRenderOptions(mockClient));
    };

    it("renders the correct labels for banned and unbanned members", () => {
        // test for room
        const propsWithBanMembership = {
            ...defaultAdminToolsProps,
            member: memberWithBanMembership,
        };

        // defaultMember is not banned
        const { result } = renderBanButtonHook();
        expect(result.current.banLabel).toBe("Ban from room");
        cleanup();

        const { result: result2 } = renderBanButtonHook(propsWithBanMembership);
        expect(result2.current.banLabel).toBe("Unban from room");
        cleanup();

        // test for space
        const { result: result3 } = renderBanButtonHook({ ...defaultAdminToolsProps, room: mockSpace });
        expect(result3.current.banLabel).toBe("Ban from space");
        cleanup();

        const { result: result4 } = renderBanButtonHook({
            ...propsWithBanMembership,
            room: mockSpace,
        });
        expect(result4.current.banLabel).toBe("Unban from space");
        cleanup();
    });

    it("clicking the ban or unban button calls Modal.createDialog with the correct arguments if user is not banned", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: vi.fn() });

        const propsWithSpace = {
            ...defaultAdminToolsProps,
            room: mockSpace,
        };
        const { result } = renderBanButtonHook(propsWithSpace);
        await result.current.onBanOrUnbanClick();

        // check the last call arguments and the presence of the spaceChildFilter callback
        expect(createDialogSpy).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({ spaceChildFilter: expect.any(Function) }),
            "mx_ConfirmSpaceUserActionDialog_wrapper",
        );

        // test the spaceChildFilter callback
        const callback = createDialogSpy.mock.lastCall![1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // truthy my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: "is not ban", powerLevel: 0 };

        const mockRoom = {
            getMember: vi
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: vi.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });

    it("clicking the ban or unban button calls Modal.createDialog with the correct arguments if user _is_ banned", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: vi.fn() });

        const propsWithBanMembership = {
            ...defaultAdminToolsProps,
            member: memberWithBanMembership,
            room: mockSpace,
        };
        const { result } = renderBanButtonHook(propsWithBanMembership);
        await result.current.onBanOrUnbanClick();

        // check the last call arguments and the presence of the spaceChildFilter callback
        expect(createDialogSpy).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({ spaceChildFilter: expect.any(Function) }),
            "mx_ConfirmSpaceUserActionDialog_wrapper",
        );

        // test the spaceChildFilter callback
        const callback = createDialogSpy.mock.lastCall![1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: KnownMembership.Ban, powerLevel: 0 };

        const mockRoom = {
            getMember: vi
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: vi.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });
});
