/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { UserInfoAdminToolsContainer } from "../../../../../src/components/views/right_panel/user_info/UserInfoAdminToolsContainer";
import { stubClient } from "../../../../test-utils";

jest.mock("../../../../../src/utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});
// Mock the view models
jest.mock("../../../../../src/components/viewmodels/right_panel/UserInfoAdminToolsContainerViewModel");

const mockViewModel = jest.requireMock(
    "../../../../../src/components/viewmodels/right_panel/UserInfoAdminToolsContainerViewModel",
);

const defaultRoomId = "!fkfk";

describe("UserInfoAdminToolsContainer", () => {
    // Setup it data
    const mockRoom = mocked({
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

    const mockMember = {
        userId: "@user:example.com",
        membership: "join",
        powerLevel: 0,
    } as unknown as RoomMember;

    const mockPowerLevels = {
        users: {
            "@currentuser:example.com": 100,
        },
        events: {},
        state_default: 50,
        ban: 50,
        kick: 50,
        redact: 50,
    };

    const defaultProps = {
        room: mockRoom,
        member: mockMember,
        powerLevels: mockPowerLevels,
        isUpdating: false,
        startUpdating: jest.fn(),
        stopUpdating: jest.fn(),
    };

    const renderComponent = () => {
        return render(<UserInfoAdminToolsContainer {...defaultProps} />);
    };
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the current user
        stubClient();

        // Setup the mock view model functions
        mockViewModel.useUserInfoAdminToolsContainerViewModel = jest.fn().mockReturnValue({
            isCurrentUserInTheRoom: true,
            shouldShowKickButton: true,
            shouldShowBanButton: true,
            shouldShowMuteButton: true,
            shouldShowRedactButton: true,
        });

        mockViewModel.useRoomKickButtonViewModel = jest.fn().mockReturnValue({
            canUserBeKicked: true,
            kickLabel: "Kick",
            onKickClick: jest.fn(),
        });

        mockViewModel.useBanButtonViewModel = jest.fn().mockReturnValue({
            banLabel: "Ban",
            onBanOrUnbanClick: jest.fn(),
        });

        mockViewModel.useMuteButtonViewModel = jest.fn().mockReturnValue({
            isMemberInTheRoom: true,
            muteLabel: "Mute",
            onMuteButtonClick: jest.fn(),
        });

        mockViewModel.useRedactMessagesButtonViewModel = jest.fn().mockReturnValue({
            onRedactAllMessagesClick: jest.fn(),
        });
    });

    it("renders all admin tools when user has permissions", () => {
        renderComponent();

        // Check that all buttons are rendered
        expect(screen.getByText("Mute")).toBeInTheDocument();
        expect(screen.getByText("Kick")).toBeInTheDocument();
        expect(screen.getByText("Ban")).toBeInTheDocument();
        expect(screen.getByText("Remove messages")).toBeInTheDocument();
    });

    it("renders no admin tools when current user is not in the room", () => {
        mockViewModel.useUserInfoAdminToolsContainerViewModel.mockReturnValue({
            isCurrentUserInTheRoom: false,
            shouldShowKickButton: false,
            shouldShowBanButton: false,
            shouldShowMuteButton: false,
            shouldShowRedactButton: false,
        });

        const { container } = renderComponent();

        // Should render an empty div
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it("renders children when provided", () => {
        render(
            <UserInfoAdminToolsContainer {...defaultProps}>
                <div data-testid="child-element">Custom Child</div>
            </UserInfoAdminToolsContainer>,
        );

        expect(screen.getByTestId("child-element")).toBeInTheDocument();
        expect(screen.getByText("Custom Child")).toBeInTheDocument();
    });

    describe("Kick behavior", () => {
        it("clicking kick button calls the appropriate handler", () => {
            renderComponent();

            const kickButton = screen.getByText("Kick");
            fireEvent.click(kickButton);

            expect(mockViewModel.useRoomKickButtonViewModel().onKickClick).toHaveBeenCalled();
        });

        it("should not display kick buttun if user can't be kicked", () => {
            mockViewModel.useRoomKickButtonViewModel.mockReturnValue({
                canUserBeKicked: false,
                kickLabel: "Kick",
                onKickClick: jest.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Kick")).not.toBeInTheDocument();
        });

        it("should display the correct label when user can be kicked", () => {
            mockViewModel.useRoomKickButtonViewModel.mockReturnValue({
                canUserBeKicked: true,
                kickLabel: "Disinvite",
                onKickClick: jest.fn(),
            });
            renderComponent();

            const kickButton = screen.getByText("Disinvite");
            fireEvent.click(kickButton);

            expect(mockViewModel.useRoomKickButtonViewModel().kickLabel).toBe("Disinvite");
        });
    });

    describe("Ban behavior", () => {
        it("clicking ban button calls the appropriate handler", () => {
            renderComponent();

            const banButton = screen.getByText("Ban");
            fireEvent.click(banButton);

            expect(mockViewModel.useBanButtonViewModel().onBanOrUnbanClick).toHaveBeenCalled();
        });

        it("should display the correct label when user can be banned", () => {
            mockViewModel.useBanButtonViewModel.mockReturnValue({
                banLabel: "Unban",
                onBanOrUnbanClick: jest.fn(),
            });
            renderComponent();

            const banButton = screen.getByText("Unban");
            fireEvent.click(banButton);

            expect(mockViewModel.useBanButtonViewModel().banLabel).toBe("Unban");
        });
    });

    describe("Mute behavior", () => {
        it("clicking mute button calls the appropriate handler", () => {
            renderComponent();

            const muteButton = screen.getByText("Mute");
            fireEvent.click(muteButton);

            expect(mockViewModel.useMuteButtonViewModel().onMuteButtonClick).toHaveBeenCalled();
        });

        it("should not display mute button if user is not in the room", () => {
            mockViewModel.useMuteButtonViewModel.mockReturnValue({
                isMemberInTheRoom: false,
                muteLabel: "Mute",
                onMuteButtonClick: jest.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Mute")).not.toBeInTheDocument();
        });

        it("should display the correct label when user can be muted", () => {
            mockViewModel.useMuteButtonViewModel.mockReturnValue({
                isMemberInTheRoom: true,
                muteLabel: "Unmmute",
                onMuteButtonClick: jest.fn(),
            });
            renderComponent();

            const muteButton = screen.getByText("Unmmute");
            fireEvent.click(muteButton);

            expect(mockViewModel.useMuteButtonViewModel().muteLabel).toBe("Unmmute");
        });
    });

    describe("Redact behavior", () => {
        it("clicking redact button calls the appropriate handler", () => {
            renderComponent();

            const redactButton = screen.getByText("Remove messages");
            fireEvent.click(redactButton);

            expect(mockViewModel.useRedactMessagesButtonViewModel().onRedactAllMessagesClick).toHaveBeenCalled();
        });
    });
});
