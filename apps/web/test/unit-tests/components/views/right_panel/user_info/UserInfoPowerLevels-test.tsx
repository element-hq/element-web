/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { MatrixEvent, type MatrixClient, RoomMember, type Room, EventType } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { type IRoomPermissions } from "../../../../../../src/components/views/right_panel/UserInfo";
import { PowerLevelSection } from "../../../../../../src/components/views/right_panel/user_info/UserInfoPowerLevels";

describe("<PowerLevelEditor />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

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
    });

    afterAll(() => {
        defaultProps = {
            user: defaultMember,
            room: mockRoom,
            roomPermissions: {
                modifyLevelMax: 100,
                canEdit: false,
                canInvite: false,
            },
        };
        jest.clearAllMocks();
    });

    const renderComponent = (props = defaultProps) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<PowerLevelSection {...props} />, {
            wrapper: Wrapper,
        });
    };

    it("renders a power level combobox if can edit is true", () => {
        const startPowerLevel = 999;
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: startPowerLevel }, users_default: 1 },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);

        renderComponent({
            ...defaultProps,
            room: mockRoom,
            roomPermissions: { ...defaultProps.roomPermissions, canEdit: true },
        });

        expect(screen.getByRole("combobox", { name: "Power level" })).toBeInTheDocument();
    });

    it("renders a user role if can edit is false", () => {
        const member = new RoomMember(defaultRoomId, defaultUserId);
        member.powerLevel = 100;
        renderComponent({ ...defaultProps, user: member });

        expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("renders a combobox and attempts to change power level on change of the combobox", async () => {
        const startPowerLevel = 999;
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: startPowerLevel }, users_default: 1 },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockClient.getSafeUserId.mockReturnValueOnce(defaultUserId);
        mockClient.getUserId.mockReturnValueOnce(defaultUserId);
        renderComponent({
            ...defaultProps,
            room: mockRoom,
            roomPermissions: { ...defaultProps.roomPermissions, canEdit: true },
        });

        const changedPowerLevel = 100;

        fireEvent.change(screen.getByRole("combobox", { name: "Power level" }), {
            target: { value: changedPowerLevel },
        });

        await screen.findByText("Demote", { exact: true });

        // firing the event will raise a dialog warning about self demotion, wait for this to appear then click on it
        await userEvent.click(await screen.findByText("Demote", { exact: true }));
        expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1);
        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, changedPowerLevel);
    });
});
