/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import {
    type Room,
    type MatrixClient,
    RoomMember,
    type MatrixEvent,
    type ISendEventResponse,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { type RoomAdminToolsProps } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { useMuteButtonViewModel } from "../../../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel";
import { isMuted } from "../../../../../../../src/components/views/right_panel/UserInfo";
import { withClientContextRenderOptions } from "../../../../../../test-utils";

describe("useMuteButtonViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    let mockRoom: Mocked<Room>;
    let mockClient: Mocked<MatrixClient>;

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

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

        mockClient.setPowerLevel.mockImplementation(() => Promise.resolve({} as ISendEventResponse));

        mockRoom.currentState.getStateEvents.mockReturnValueOnce({
            getContent: jest.fn().mockReturnValue({
                events: {
                    "m.room.message": 0,
                },
                events_default: 0,
            }),
        } as unknown as MatrixEvent);

        jest.spyOn(mockClient, "setPowerLevel").mockImplementation(() => Promise.resolve({} as ISendEventResponse));
        jest.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValue({
            getContent: jest.fn().mockReturnValue({
                events: {
                    "m.room.message": 0,
                },
                events_default: 0,
            }),
        } as unknown as MatrixEvent);
    });

    afterEach(() => {
        jest.clearAllMocks();
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

        jest.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValueOnce({
            getContent: jest.fn().mockReturnValue({
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
