/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { cleanup, renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { type Room, type MatrixClient, RoomMember, type IPowerLevelsContent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import {
    type RoomAdminToolsContainerProps,
    type RoomAdminToolsProps,
    useBanButtonViewModel,
    useMuteButtonViewModel,
    useRedactMessagesButtonViewModel,
    useRoomKickButtonViewModel,
    useUserInfoAdminToolsContainerViewModel,
} from "../../../../../src/components/viewmodels/right_panel/UserInfoAdminToolsContainerViewModel";
import Modal from "../../../../../src/Modal";
import { isMuted } from "../../../../../src/components/views/right_panel/UserInfo";
import BulkRedactDialog from "../../../../../src/components/views/dialogs/BulkRedactDialog";

describe("UserInfoAdminToolsContainerViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockSpace: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;
    let mockPowerLevels: IPowerLevelsContent;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const memberWithBanMembership = { ...defaultMember, membership: KnownMembership.Ban } as RoomMember;
    const memberWithInviteMembership = { ...defaultMember, membership: KnownMembership.Invite } as RoomMember;
    const memberWithJoinMembership = { ...defaultMember, membership: KnownMembership.Join } as RoomMember;

    let defaultContainerProps: RoomAdminToolsContainerProps;
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
            children: null,
        };

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
        jest.spyOn(React, "useContext").mockReturnValue(mockClient);
    });

    const renderAdminToolsContainerHook = (props = defaultContainerProps) => {
        return renderHook(() => useUserInfoAdminToolsContainerViewModel(props));
    };

    const renderKickButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useRoomKickButtonViewModel(props));
    };

    const renderBanButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useBanButtonViewModel(props));
    };

    const renderRedactButtonHook = (props = defaultMember) => {
        return renderHook(() => useRedactMessagesButtonViewModel(props));
    };

    const renderMuteButtonHook = (props = defaultAdminToolsProps) => {
        return renderHook(() => useMuteButtonViewModel(props));
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

    describe("useRoomKickButtonViewModel", () => {
        const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

        beforeEach(() => {
            mockRoom.getMember.mockReturnValue(defaultMember);
        });

        afterEach(() => {
            createDialogSpy.mockReset();
        });

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

            // test for space
            const { result: result3 } = renderKickButtonHook({ ...propsWithJoinMembership, room: mockSpace });
            expect(result3.current.kickLabel).toBe("Remove from space");
            cleanup();

            const { result: result4 } = renderKickButtonHook({ ...propsWithInviteMembership, room: mockSpace });
            expect(result4.current.kickLabel).toBe("Disinvite from space");
            cleanup();
        });

        it("clicking the kick button calls Modal.createDialog with the correct arguments when room is a space", async () => {
            createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });
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

    describe("useBanButtonViewModel", () => {
        const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

        beforeEach(() => {
            mockRoom.getMember.mockReturnValue(defaultMember);
        });

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

    describe("useRedactMessagesButtonViewModel", () => {
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

    describe("useMuteButtonViewModel", () => {
        it("should early return when isUpdating=true", async () => {
            const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
            mockMeMember.powerLevel = 51; // defaults to 50
            mockRoom.getMember.mockReturnValueOnce(mockMeMember);

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

        it("returns false if either argument is falsy", () => {
            // @ts-ignore to let us purposely pass incorrect args
            expect(isMuted(defaultMember, null)).toBe(false);
            // @ts-ignore to let us purposely pass incorrect args
            expect(isMuted(null, {})).toBe(false);
        });

        it("when powerLevelContent.events and .events_default are undefined, returns false", () => {
            const powerLevelContents = {};
            expect(isMuted(defaultMember, powerLevelContents)).toBe(false);
        });

        it("when powerLevelContent.events is undefined, uses .events_default", () => {
            const higherPowerLevelContents = { events_default: 10 };
            expect(isMuted(defaultMember, higherPowerLevelContents)).toBe(true);

            const lowerPowerLevelContents = { events_default: -10 };
            expect(isMuted(defaultMember, lowerPowerLevelContents)).toBe(false);
        });

        it("when powerLevelContent.events is defined but '.m.room.message' isn't, uses .events_default", () => {
            const higherPowerLevelContents = { events: {}, events_default: 10 };
            expect(isMuted(defaultMember, higherPowerLevelContents)).toBe(true);

            const lowerPowerLevelContents = { events: {}, events_default: -10 };
            expect(isMuted(defaultMember, lowerPowerLevelContents)).toBe(false);
        });

        it("when powerLevelContent.events and '.m.room.message' are defined, uses the value", () => {
            const higherPowerLevelContents = { events: { "m.room.message": -10 }, events_default: 10 };
            expect(isMuted(defaultMember, higherPowerLevelContents)).toBe(false);

            const lowerPowerLevelContents = { events: { "m.room.message": 10 }, events_default: -10 };
            expect(isMuted(defaultMember, lowerPowerLevelContents)).toBe(true);
        });
    });
});
