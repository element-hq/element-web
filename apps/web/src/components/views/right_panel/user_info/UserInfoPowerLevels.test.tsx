/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterAll, vi, type Mocked } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "test-utils-rtl";
import { MatrixEvent, type MatrixClient, RoomMember, type Room, EventType } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { type IRoomPermissions } from "../UserInfo";
import { PowerLevelSection } from "./UserInfoPowerLevels";

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

        mockClient = vi.mocked({
            getUser: vi.fn(),
            isGuest: vi.fn().mockReturnValue(false),
            isUserIgnored: vi.fn(),
            getIgnoredUsers: vi.fn(),
            setIgnoredUsers: vi.fn(),
            getUserId: vi.fn(),
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
            setPowerLevel: vi.fn().mockResolvedValueOnce({ event_id: "123" }),
        } as unknown as MatrixClient);

        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
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
        vi.clearAllMocks();
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
        vi.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValue(powerLevelEvent);

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
        const self = new RoomMember(defaultRoomId, defaultUserId);
        self.powerLevel = startPowerLevel;
        vi.spyOn(mockRoom.currentState, "getStateEvents").mockReturnValue(powerLevelEvent);
        mockRoom.getMember.mockReturnValue(self);
        mockClient.getSafeUserId.mockReturnValueOnce(defaultUserId);
        mockClient.getUserId.mockReturnValueOnce(defaultUserId);
        renderComponent({
            ...defaultProps,
            room: mockRoom,
            roomPermissions: { ...defaultProps.roomPermissions, canEdit: true },
        });

        const changedPowerLevel = 100;

        fireEvent.change(screen.getByRole("combobox", { name: "Power level" }), {
            target: { value: String(changedPowerLevel) },
        });

        await screen.findByText("Demote", { exact: true });

        // firing the event will raise a dialog warning about self demotion, wait for this to appear then click on it
        await userEvent.click(await screen.findByText("Demote", { exact: true }));
        expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1);
        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, changedPowerLevel);
    });
});
