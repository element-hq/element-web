/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { type Room, RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen } from "jest-matrix-react";

import { mkStubRoom, stubClient } from "../../../../../test-utils";
import {
    useUserInfoBasicOptionsSection,
    type UserInfoBasicOptionsState,
} from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel";
import { UserInfoBasicOptions } from "../../../../../../src/components/views/right_panel/user_info/UserInfoBasicOptions";
import { UIComponent } from "../../../../../../src/settings/UIFeature";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";

jest.mock("../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel", () => ({
    useUserInfoBasicOptionsSection: jest.fn(),
}));

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => {
    const original = jest.requireActual("../../../../../../src/customisations/helpers/UIComponents");
    return {
        shouldShowComponent: jest.fn().mockImplementation(original.shouldShowComponent),
    };
});

describe("<UserOptionsSection />", () => {
    const defaultValue: UserInfoBasicOptionsState = {
        showInviteButton: false,
        showInsertPillButton: false,
        readReceiptButtonDisabled: false,
        onInsertPillButton: () => jest.fn(),
        onReadReceiptButton: () => jest.fn(),
        onShareUserClick: () => jest.fn(),
        onInviteUserButton: (evt: Event) => Promise.resolve(),
    };

    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    let defaultRoom: Room;

    let defaultProps: { isMe: boolean; member: User | RoomMember; room: Room };

    beforeEach(() => {
        const matrixClient = stubClient();
        defaultRoom = mkStubRoom(defaultRoomId, defaultRoomId, matrixClient);
        defaultProps = {
            isMe: false,
            member: defaultMember,
            room: defaultRoom,
        };
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should always display sharedButton when user is not me", () => {
        // User is not me by default
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue });
        render(<UserInfoBasicOptions {...defaultProps} />);
        const sharedButton = screen.getByRole("button", { name: "Share profile" });
        expect(sharedButton).toBeInTheDocument();
    });

    it("should always display sharedButton when user is me", () => {
        const propsWithMe = { ...defaultProps, isMe: true };
        const onShareUserClick = jest.fn();
        const state = { ...defaultValue, onShareUserClick };

        mocked(useUserInfoBasicOptionsSection).mockReturnValue(state);
        render(<UserInfoBasicOptions {...propsWithMe} />);

        const sharedButton2 = screen.getByRole("button", { name: "Share profile" });
        expect(sharedButton2).toBeInTheDocument();

        // clicking on the share profile button
        fireEvent.click(sharedButton2);

        expect(onShareUserClick).toHaveBeenCalled();
    });

    it("should show insert pill button when user is not me and showinsertpill is true", () => {
        const onInsertPillButton = jest.fn();
        const state = { ...defaultValue, showInsertPillButton: true, onInsertPillButton };
        // User is not me and showInsertpill is true
        mocked(useUserInfoBasicOptionsSection).mockReturnValue(state);
        render(<UserInfoBasicOptions {...defaultProps} />);

        const insertPillButton = screen.getByRole("button", { name: "Mention" });
        expect(insertPillButton).toBeInTheDocument();

        // clicking on the insert pill button
        fireEvent.click(insertPillButton);

        expect(onInsertPillButton).toHaveBeenCalled();
    });

    it("should not show insert pill button when user is not me and showinsertpill is false", () => {
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue, showInsertPillButton: false });
        render(<UserInfoBasicOptions {...defaultProps} />);
        const insertPillButton = screen.queryByRole("button", { name: "Mention" });
        expect(insertPillButton).not.toBeInTheDocument();
    });

    it("should not show insert pill button when user is me", () => {
        // User is me, should not see the insert button even when show insertpill is true
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue, showInsertPillButton: true });
        const propsWithMe = { ...defaultProps, isMe: true };
        render(<UserInfoBasicOptions {...propsWithMe} />);
        const insertPillButton = screen.queryByRole("button", { name: "Mention" });
        expect(insertPillButton).not.toBeInTheDocument();
    });

    it("should not show readreceiptbutton when user is me", () => {
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue, readReceiptButtonDisabled: true });
        const propsWithMe = { ...defaultProps, isMe: true };
        render(<UserInfoBasicOptions {...propsWithMe} />);

        const readReceiptButton = screen.queryByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).not.toBeInTheDocument();
    });

    it("should show disable readreceiptbutton when readReceiptButtonDisabled is true", () => {
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue, readReceiptButtonDisabled: true });
        render(<UserInfoBasicOptions {...defaultProps} />);

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).toBeDisabled();
    });

    it("should not show disable readreceiptbutton when readReceiptButtonDisabled is false", () => {
        const onReadReceiptButton = jest.fn();
        const state = { ...defaultValue, readReceiptButtonDisabled: false, onReadReceiptButton };
        mocked(useUserInfoBasicOptionsSection).mockReturnValue(state);
        render(<UserInfoBasicOptions {...defaultProps} />);

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).not.toBeDisabled();

        // clicking on the read receipt button
        fireEvent.click(readReceiptButton);

        expect(onReadReceiptButton).toHaveBeenCalled();
    });

    it("should show not show invite button if shouldShowComponent is false", () => {
        mocked(useUserInfoBasicOptionsSection).mockReturnValue({ ...defaultValue, showInviteButton: true });
        mocked(shouldShowComponent).mockReturnValue(false);
        render(<UserInfoBasicOptions {...defaultProps} />);

        const inviteButton = screen.queryByRole("button", { name: "Invite" });
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(inviteButton).not.toBeInTheDocument();
    });

    it("should show show invite button if shouldShowComponent is true", () => {
        const onInviteUserButton = jest.fn();
        const state = { ...defaultValue, showInviteButton: true, onInviteUserButton };
        mocked(useUserInfoBasicOptionsSection).mockReturnValue(state);
        mocked(shouldShowComponent).mockReturnValue(true);
        render(<UserInfoBasicOptions {...defaultProps} />);

        const inviteButton = screen.getByRole("button", { name: "Invite" });
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(inviteButton).toBeInTheDocument();

        // clicking on the invite button
        fireEvent.click(inviteButton);
        expect(onInviteUserButton).toHaveBeenCalled();
    });

    it("should show directMessageButton when user is not me", () => {
        // User is not me, direct message button should display
        mocked(useUserInfoBasicOptionsSection).mockReturnValue(defaultValue);
        mocked(shouldShowComponent).mockReturnValue(true);
        render(<UserInfoBasicOptions {...defaultProps} />);
        const dmButton = screen.getByRole("button", { name: "Send message" });
        expect(dmButton).toBeInTheDocument();
    });

    it("should not show directMessageButton when user is me", () => {
        mocked(useUserInfoBasicOptionsSection).mockReturnValue(defaultValue);
        mocked(shouldShowComponent).mockReturnValue(true);
        const propsWithMe = { ...defaultProps, isMe: true };
        render(<UserInfoBasicOptions {...propsWithMe} />);
        const dmButton = screen.queryByRole("button", { name: "Send message" });
        expect(dmButton).not.toBeInTheDocument();
    });
});
