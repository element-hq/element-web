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
import { useRoomKickButtonViewModel } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel";
import Modal from "../../../../../../../src/Modal";
import { withClientContextRenderOptions } from "../../../../../../test-utils";

describe("useRoomKickButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockSpace: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const memberWithInviteMembership = { ...defaultMember, membership: KnownMembership.Invite } as RoomMember;
    const memberWithJoinMembership = { ...defaultMember, membership: KnownMembership.Join } as RoomMember;

    const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

    let defaultAdminToolsProps: RoomAdminToolsProps;

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
        // mock useContext to return mockClient
        // jest.spyOn(React, "useContext").mockReturnValue(mockClient);

        mockRoom.getMember.mockReturnValue(defaultMember);
    });

    afterEach(() => {
        createDialogSpy.mockReset();
    });

    const renderKickButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useRoomKickButtonViewModel(props), withClientContextRenderOptions(mockClient));
    };

    it("renders nothing if member.membership is undefined", () => {
        // .membership is undefined in our member by default
        const { result } = renderKickButtonHook();
        expect(result.current.canUserBeKicked).toBe(false);
    });

    it("renders something if member.membership is 'invite' or 'join'", () => {
        let props = {
            ...defaultAdminToolsProps,
            member: memberWithInviteMembership,
        };
        const { result } = renderKickButtonHook(props);
        expect(result.current.canUserBeKicked).toBe(true);

        cleanup();

        props = {
            ...defaultAdminToolsProps,
            member: memberWithJoinMembership,
        };
        const { result: result2 } = renderKickButtonHook(props);
        expect(result2.current.canUserBeKicked).toBe(true);
    });

    it("renders the correct label", () => {
        // test for room
        const propsWithJoinMembership = {
            ...defaultAdminToolsProps,
            member: memberWithJoinMembership,
        };

        const { result } = renderKickButtonHook(propsWithJoinMembership);
        expect(result.current.kickLabel).toBe("Remove from room");
        cleanup();

        const propsWithInviteMembership = {
            ...defaultAdminToolsProps,
            member: memberWithInviteMembership,
        };

        const { result: result2 } = renderKickButtonHook(propsWithInviteMembership);
        expect(result2.current.kickLabel).toBe("Disinvite from room");
        cleanup();
    });

    it("renders the correct label for space", () => {
        const propsWithInviteMembership = {
            ...defaultAdminToolsProps,
            room: mockSpace,
            member: memberWithInviteMembership,
        };

        const propsWithJoinMembership = {
            ...defaultAdminToolsProps,
            room: mockSpace,
            member: memberWithJoinMembership,
        };

        const { result: result3 } = renderKickButtonHook(propsWithJoinMembership);
        expect(result3.current.kickLabel).toBe("Remove from space");
        cleanup();

        const { result: result4 } = renderKickButtonHook(propsWithInviteMembership);
        expect(result4.current.kickLabel).toBe("Disinvite from space");
        cleanup();
    });

    it("clicking the kick button calls Modal.createDialog with the correct arguments when room is a space", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);

        const propsWithInviteMembership = {
            ...defaultAdminToolsProps,
            room: mockSpace,
            member: memberWithInviteMembership,
        };
        const { result } = renderKickButtonHook(propsWithInviteMembership);

        await result.current.onKickClick();

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
        const mockTheirMember = { membership: KnownMembership.Invite, powerLevel: 0 };

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
