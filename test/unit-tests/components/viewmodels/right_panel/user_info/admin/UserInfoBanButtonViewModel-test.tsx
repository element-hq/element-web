/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { cleanup, renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { type Room, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { type RoomAdminToolsProps } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { useBanButtonViewModel } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel";
import Modal from "../../../../../../../src/Modal";
import { withClientContextRenderOptions } from "../../../../../../test-utils";

describe("useBanButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockSpace: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const memberWithBanMembership = { ...defaultMember, membership: KnownMembership.Ban } as RoomMember;

    let defaultAdminToolsProps: RoomAdminToolsProps;
    const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

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

        mockSpace = mocked({
            roomId: defaultRoomId,
            getType: jest.fn().mockReturnValue("m.space"),
            isSpaceRoom: jest.fn().mockReturnValue(true),
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

        defaultAdminToolsProps = {
            room: mockRoom,
            member: defaultMember,
            isUpdating: false,
            startUpdating: jest.fn(),
            stopUpdating: jest.fn(),
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
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

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
        const callback = createDialogSpy.mock.lastCall[1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // truthy my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: "is not ban", powerLevel: 0 };

        const mockRoom = {
            getMember: jest
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: jest.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });

    it("clicking the ban or unban button calls Modal.createDialog with the correct arguments if user _is_ banned", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

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
        const callback = createDialogSpy.mock.lastCall[1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: KnownMembership.Ban, powerLevel: 0 };

        const mockRoom = {
            getMember: jest
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: jest.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });
});
