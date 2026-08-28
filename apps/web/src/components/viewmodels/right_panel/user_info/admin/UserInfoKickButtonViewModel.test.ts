/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked, type MockInstance } from "vitest";
import { cleanup, renderHook } from "test-utils-rtl";
import { type Room, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { type RoomAdminToolsProps } from "./UserInfoAdminToolsContainerViewModel";
import { useRoomKickButtonViewModel } from "./UserInfoKickButtonViewModel";
import Modal from "../../../../../Modal";

describe("useRoomKickButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockSpace: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const memberWithInviteMembership = { ...defaultMember, membership: KnownMembership.Invite } as RoomMember;
    const memberWithJoinMembership = { ...defaultMember, membership: KnownMembership.Join } as RoomMember;

    const createDialogSpy: MockInstance = vi.spyOn(Modal, "createDialog");

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
        // mock useContext to return mockClient
        // vi.spyOn(React, "useContext").mockReturnValue(mockClient);

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
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: vi.fn() });

        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);

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
        const callback = createDialogSpy.mock.lastCall![1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: KnownMembership.Invite, powerLevel: 0 };

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
