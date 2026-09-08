/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "test-utils-rtl";
import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { stubClient } from "test-utils";
import { UserInfoAdminToolsContainer } from "./UserInfoAdminToolsContainer";
import { useUserInfoAdminToolsContainerViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { useRoomKickButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel";
import { useBanButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel";
import { useMuteButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel";
import { useRedactMessagesButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";

vi.mock("../../../../utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: vi.fn(),
        getDMRoomsForUserId: vi.fn(),
    };

    return {
        shared: vi.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

vi.mock("../../../viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel", () => ({
    useUserInfoAdminToolsContainerViewModel: vi.fn().mockReturnValue({
        isCurrentUserInTheRoom: true,
        shouldShowKickButton: true,
        shouldShowBanButton: true,
        shouldShowMuteButton: true,
        shouldShowRedactButton: true,
    }),
}));

vi.mock("../../../viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel", () => ({
    useRoomKickButtonViewModel: vi.fn().mockReturnValue({
        canUserBeKicked: true,
        kickLabel: "Kick",
        onKickClick: vi.fn(),
    }),
}));

vi.mock("../../../viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel", () => ({
    useBanButtonViewModel: vi.fn().mockReturnValue({
        banLabel: "Ban",
        onBanOrUnbanClick: vi.fn(),
    }),
}));

vi.mock("../../../viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel", () => ({
    useMuteButtonViewModel: vi.fn().mockReturnValue({
        isMemberInTheRoom: true,
        muteLabel: "Mute",
        onMuteButtonClick: vi.fn(),
    }),
}));

vi.mock("../../../viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel", () => ({
    useRedactMessagesButtonViewModel: vi.fn().mockReturnValue({
        onRedactAllMessagesClick: vi.fn(),
    }),
}));

const defaultRoomId = "!fkfk";

describe("UserInfoAdminToolsContainer", () => {
    // Setup it data
    const mockRoom = vi.mocked({
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
        startUpdating: vi.fn(),
        stopUpdating: vi.fn(),
    };

    const mockMatrixClient = stubClient();

    const renderComponent = (props = defaultProps) => {
        return render(
            <MatrixClientContext.Provider value={mockMatrixClient}>
                <UserInfoAdminToolsContainer {...props} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        vi.mocked(useUserInfoAdminToolsContainerViewModel).mockReturnValue({
            isCurrentUserInTheRoom: true,
            shouldShowKickButton: true,
            shouldShowBanButton: true,
            shouldShowMuteButton: true,
            shouldShowRedactButton: true,
        });
        vi.clearAllMocks();
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
        vi.mocked(useUserInfoAdminToolsContainerViewModel).mockReturnValue({
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
            const mockedOnKickClick = vi.fn();
            vi.mocked(useRoomKickButtonViewModel).mockReturnValue({
                canUserBeKicked: true,
                kickLabel: "Kick",
                onKickClick: mockedOnKickClick,
            });
            renderComponent();

            const kickButton = screen.getByText("Kick");
            fireEvent.click(kickButton);

            expect(mockedOnKickClick).toHaveBeenCalled();
        });

        it("should not display kick buttun if user can't be kicked", () => {
            vi.mocked(useRoomKickButtonViewModel).mockReturnValue({
                canUserBeKicked: false,
                kickLabel: "Kick",
                onKickClick: vi.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Kick")).not.toBeInTheDocument();
        });

        it("should display the correct label when user can be disinvited", () => {
            vi.mocked(useRoomKickButtonViewModel).mockReturnValue({
                canUserBeKicked: true,
                kickLabel: "Disinvite",
                onKickClick: vi.fn(),
            });

            renderComponent({
                ...defaultProps,
                member: mockMember,
            });

            expect(screen.getByText("Disinvite")).toBeInTheDocument();
        });
    });

    describe("Ban behavior", () => {
        it("clicking ban button calls the appropriate handler", () => {
            const mockedOnBanOrUnbanClick = vi.fn();
            vi.mocked(useBanButtonViewModel).mockReturnValue({
                banLabel: "Ban",
                onBanOrUnbanClick: mockedOnBanOrUnbanClick,
            });
            renderComponent();

            const banButton = screen.getByText("Ban");
            fireEvent.click(banButton);

            expect(mockedOnBanOrUnbanClick).toHaveBeenCalled();
        });

        it("should display the correct label", () => {
            const mockedOnBanOrUnbanClick = vi.fn();
            vi.mocked(useBanButtonViewModel).mockReturnValue({
                banLabel: "Unban",
                onBanOrUnbanClick: mockedOnBanOrUnbanClick,
            });
            renderComponent();

            // The label should be "Unban"
            expect(screen.getByText("Unban")).toBeInTheDocument();
        });
    });

    describe("Mute behavior", () => {
        it("clicking mute button calls the appropriate handler", () => {
            const mockedOnMuteButtonClick = vi.fn();
            vi.mocked(useMuteButtonViewModel).mockReturnValue({
                isMemberInTheRoom: true,
                muteLabel: "Mute",
                onMuteButtonClick: mockedOnMuteButtonClick,
            });
            renderComponent();

            const muteButton = screen.getByText("Mute");
            fireEvent.click(muteButton);

            expect(mockedOnMuteButtonClick).toHaveBeenCalled();
        });

        it("should not display mute button if user is not in the room", () => {
            vi.mocked(useMuteButtonViewModel).mockReturnValue({
                isMemberInTheRoom: false,
                muteLabel: "Mute",
                onMuteButtonClick: vi.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Mute")).not.toBeInTheDocument();
        });

        it("should display the correct label", () => {
            vi.mocked(useMuteButtonViewModel).mockReturnValue({
                isMemberInTheRoom: true,
                muteLabel: "Mute",
                onMuteButtonClick: vi.fn(),
            });
            renderComponent();

            expect(screen.getByText("Mute")).toBeInTheDocument();
        });
    });

    describe("Redact behavior", () => {
        it("clicking redact button calls the appropriate handler", () => {
            const mockedOnRedactAllMessagesClick = vi.fn();
            vi.mocked(useRedactMessagesButtonViewModel).mockReturnValue({
                onRedactAllMessagesClick: mockedOnRedactAllMessagesClick,
            });
            renderComponent();

            const redactButton = screen.getByText("Remove messages");
            fireEvent.click(redactButton);

            expect(mockedOnRedactAllMessagesClick).toHaveBeenCalled();
        });
    });
});
