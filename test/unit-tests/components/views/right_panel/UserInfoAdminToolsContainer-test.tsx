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
import { useUserInfoAdminToolsContainerViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { useRoomKickButtonViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel";
import { useBanButtonViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel";
import { useMuteButtonViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel";
import { useRedactMessagesButtonViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel";
import { stubClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

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

jest.mock(
    "../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel",
    () => ({
        useUserInfoAdminToolsContainerViewModel: jest.fn().mockReturnValue({
            isCurrentUserInTheRoom: true,
            shouldShowKickButton: true,
            shouldShowBanButton: true,
            shouldShowMuteButton: true,
            shouldShowRedactButton: true,
        }),
    }),
);

jest.mock("../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel", () => ({
    useRoomKickButtonViewModel: jest.fn().mockReturnValue({
        canUserBeKicked: true,
        kickLabel: "Kick",
        onKickClick: jest.fn(),
    }),
}));

jest.mock("../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel", () => ({
    useBanButtonViewModel: jest.fn().mockReturnValue({
        banLabel: "Ban",
        onBanOrUnbanClick: jest.fn(),
    }),
}));

jest.mock("../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel", () => ({
    useMuteButtonViewModel: jest.fn().mockReturnValue({
        isMemberInTheRoom: true,
        muteLabel: "Mute",
        onMuteButtonClick: jest.fn(),
    }),
}));

jest.mock("../../../../../src/components/viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel", () => ({
    useRedactMessagesButtonViewModel: jest.fn().mockReturnValue({
        onRedactAllMessagesClick: jest.fn(),
    }),
}));

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

    const mockMatrixClient = stubClient();

    const renderComponent = (props = defaultProps) => {
        return render(
            <MatrixClientContext.Provider value={mockMatrixClient}>
                <UserInfoAdminToolsContainer {...props} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        mocked(useUserInfoAdminToolsContainerViewModel).mockReturnValue({
            isCurrentUserInTheRoom: true,
            shouldShowKickButton: true,
            shouldShowBanButton: true,
            shouldShowMuteButton: true,
            shouldShowRedactButton: true,
        });
        jest.clearAllMocks();
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
        mocked(useUserInfoAdminToolsContainerViewModel).mockReturnValue({
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
            const mockedOnKickClick = jest.fn();
            mocked(useRoomKickButtonViewModel).mockReturnValue({
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
            mocked(useRoomKickButtonViewModel).mockReturnValue({
                canUserBeKicked: false,
                kickLabel: "Kick",
                onKickClick: jest.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Kick")).not.toBeInTheDocument();
        });

        it("should display the correct label when user can be disinvited", () => {
            mocked(useRoomKickButtonViewModel).mockReturnValue({
                canUserBeKicked: true,
                kickLabel: "Disinvite",
                onKickClick: jest.fn(),
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
            const mockedOnBanOrUnbanClick = jest.fn();
            mocked(useBanButtonViewModel).mockReturnValue({
                banLabel: "Ban",
                onBanOrUnbanClick: mockedOnBanOrUnbanClick,
            });
            renderComponent();

            const banButton = screen.getByText("Ban");
            fireEvent.click(banButton);

            expect(mockedOnBanOrUnbanClick).toHaveBeenCalled();
        });

        it("should display the correct label", () => {
            const mockedOnBanOrUnbanClick = jest.fn();
            mocked(useBanButtonViewModel).mockReturnValue({
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
            const mockedOnMuteButtonClick = jest.fn();
            mocked(useMuteButtonViewModel).mockReturnValue({
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
            mocked(useMuteButtonViewModel).mockReturnValue({
                isMemberInTheRoom: false,
                muteLabel: "Mute",
                onMuteButtonClick: jest.fn(),
            });

            renderComponent();

            expect(screen.queryByText("Mute")).not.toBeInTheDocument();
        });

        it("should display the correct label", () => {
            mocked(useMuteButtonViewModel).mockReturnValue({
                isMemberInTheRoom: true,
                muteLabel: "Mute",
                onMuteButtonClick: jest.fn(),
            });
            renderComponent();

            expect(screen.getByText("Mute")).toBeInTheDocument();
        });
    });

    describe("Redact behavior", () => {
        it("clicking redact button calls the appropriate handler", () => {
            const mockedOnRedactAllMessagesClick = jest.fn();
            mocked(useRedactMessagesButtonViewModel).mockReturnValue({
                onRedactAllMessagesClick: mockedOnRedactAllMessagesClick,
            });
            renderComponent();

            const redactButton = screen.getByText("Remove messages");
            fireEvent.click(redactButton);

            expect(mockedOnRedactAllMessagesClick).toHaveBeenCalled();
        });
    });
});
