/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { RoomMember, MatrixEvent, type Room, EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { useUserInfoPowerlevelViewModel } from "../../../../../../src/components/viewmodels/right_panel/UserInfoPowerlevelViewModel";
import { withClientContextRenderOptions } from "../../../../../test-utils";
import { type IRoomPermissions } from "../../../../../../src/components/views/right_panel/UserInfo";
import Modal from "../../../../../../src/Modal";
import { warnSelfDemote } from "../../../../../../src/components/views/right_panel/UserInfo";

jest.mock("../../../../../../src/Modal", () => ({
    createDialog: jest.fn(),
}));

jest.mock("../../../../../../src/components/views/right_panel/UserInfo", () => ({
    warnSelfDemote: jest.fn(),
}));

describe("UserInfoAdminPowerlevelViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";
    const defaultMeId = "@me:example.com";
    const selfUser = new RoomMember(defaultRoomId, defaultMeId);
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const startPowerLevel = 50;
    const changedPowerLevel = 100;

    let mockClient: Mocked<MatrixClient>;
    let mockRoom: Mocked<Room>;
    let defaultProps: {
        user: RoomMember;
        room: Room;
        roomPermissions: IRoomPermissions;
    };

    beforeEach(() => {
        defaultProps = {
            user: defaultMember,
            room: mockRoom,
            roomPermissions: {
                modifyLevelMax: 100,
                canEdit: false,
                canInvite: false,
            },
        };

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

        mockClient = mocked({
            getUser: jest.fn(),
            isGuest: jest.fn().mockReturnValue(false),
            isUserIgnored: jest.fn(),
            getIgnoredUsers: jest.fn(),
            setIgnoredUsers: jest.fn(),
            getUserId: jest.fn(),
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
            setPowerLevel: jest.fn().mockResolvedValueOnce({ event_id: "123" }),
        } as unknown as MatrixClient);

        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);

        (Modal.createDialog as jest.Mock).mockImplementation(() => ({
            finished: Promise.resolve([true]),
        }));
        (warnSelfDemote as jest.Mock).mockResolvedValue(true);
    });

    const renderComponentHook = (props = defaultProps, client = mockClient) => {
        return renderHook(
            () => useUserInfoPowerlevelViewModel(props.user, props.room),
            withClientContextRenderOptions(client),
        );
    };

    /**
     * Make `room.getMember` resolve levels the way the SDK does: an explicit `users` entry when there
     * is one, otherwise `users_default`. Without this the room reports no members at all.
     */
    const mockMembersFrom = (content: { users?: Record<string, number>; users_default?: number }): void => {
        mockRoom.getMember.mockImplementation((userId: string) => {
            const member = new RoomMember(defaultRoomId, userId);
            member.powerLevel = content.users?.[userId] ?? content.users_default ?? 0;
            return member;
        });
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should give default power level", () => {
        const defaultPowerLevel = 1;
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: defaultPowerLevel }, users_default: defaultPowerLevel },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom });

        expect(result.current.powerLevelUsersDefault).toBe(defaultPowerLevel);
    });

    it("handles successful power level change", async () => {
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: startPowerLevel }, users_default: 1 },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockClient.getSafeUserId.mockReturnValueOnce(defaultUserId);
        mockClient.getUserId.mockReturnValueOnce(defaultUserId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(changedPowerLevel);

        expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1);
        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, changedPowerLevel);
    });

    it("shows warning when promoting user to higher power level", async () => {
        const content = {
            users: {
                [defaultUserId]: startPowerLevel,
                [defaultMeId]: startPowerLevel,
            },
            users_default: 1,
        };
        const powerLevelEvent = new MatrixEvent({ type: EventType.RoomPowerLevels, content });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockMembersFrom(content);
        mockClient.getUserId.mockReturnValue(defaultMeId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(changedPowerLevel);

        expect(Modal.createDialog).toHaveBeenCalled();
        expect(mockClient.setPowerLevel).toHaveBeenCalled();
    });

    it("shows warning when self-demoting", async () => {
        const content = {
            users: { [defaultMeId]: changedPowerLevel },
            users_default: 1,
        };
        const powerLevelEvent = new MatrixEvent({ type: EventType.RoomPowerLevels, content });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockMembersFrom(content);
        mockClient.getUserId.mockReturnValue(defaultMeId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom, user: selfUser }, mockClient);

        await result.current.onPowerChange(startPowerLevel);

        expect(warnSelfDemote).toHaveBeenCalled();
        expect(mockClient.setPowerLevel).toHaveBeenCalled();
    });

    it("cancels power level change when user declines warning", async () => {
        (Modal.createDialog as jest.Mock).mockImplementation(() => ({
            finished: Promise.resolve([false]),
        }));

        const content = {
            users: {
                [defaultUserId]: startPowerLevel,
                "@me:example.com": startPowerLevel,
            },
            users_default: 1,
        };
        const powerLevelEvent = new MatrixEvent({ type: EventType.RoomPowerLevels, content });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockMembersFrom(content);
        mockClient.getUserId.mockReturnValue(defaultMeId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(changedPowerLevel);

        expect(Modal.createDialog).toHaveBeenCalled();
        expect(mockClient.setPowerLevel).not.toHaveBeenCalled();
    });

    it("shows warning when our own level comes from users_default", async () => {
        // Nobody is listed in `users`, so both of us sit on `users_default`.
        const content = { users: {}, users_default: startPowerLevel };
        const powerLevelEvent = new MatrixEvent({ type: EventType.RoomPowerLevels, content });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockMembersFrom(content);
        mockClient.getUserId.mockReturnValue(defaultMeId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(startPowerLevel);

        expect(Modal.createDialog).toHaveBeenCalled();
        expect(mockClient.setPowerLevel).toHaveBeenCalled();
    });

    it("does not warn when we outrank the new level as a room creator", async () => {
        const content = { users: { [defaultUserId]: startPowerLevel }, users_default: 1 };
        const powerLevelEvent = new MatrixEvent({ type: EventType.RoomPowerLevels, content });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockRoom.getMember.mockImplementation((userId: string) => {
            const member = new RoomMember(defaultRoomId, userId);
            // Creators outrank every assignable level, so promoting to 100 cannot match us.
            member.powerLevel = userId === defaultMeId ? Infinity : startPowerLevel;
            return member;
        });
        mockClient.getUserId.mockReturnValue(defaultMeId);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(changedPowerLevel);

        expect(Modal.createDialog).not.toHaveBeenCalled();
        expect(mockClient.setPowerLevel).toHaveBeenCalled();
    });

    it("handles missing power level event", async () => {
        mockRoom.currentState.getStateEvents.mockReturnValue(null);

        const { result } = renderComponentHook({ ...defaultProps, room: mockRoom }, mockClient);

        await result.current.onPowerChange(changedPowerLevel);

        expect(mockClient.setPowerLevel).not.toHaveBeenCalled();
    });
});
