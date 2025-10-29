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
    useUserInfoBasicOptionsViewModel,
    type UserInfoBasicOptionsState,
} from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel";
import { UserInfoBasicOptionsView } from "../../../../../../src/components/views/right_panel/user_info/UserInfoBasicOptionsView";
import { UIComponent } from "../../../../../../src/settings/UIFeature";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import { type Member } from "../../../../../../src/components/views/right_panel/UserInfo";

jest.mock("../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel", () => ({
    useUserInfoBasicOptionsViewModel: jest.fn(),
}));

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => {
    const original = jest.requireActual("../../../../../../src/customisations/helpers/UIComponents");
    return {
        shouldShowComponent: jest.fn().mockImplementation(original.shouldShowComponent),
    };
});

describe("<UserOptionsSection />", () => {
    const defaultValue: UserInfoBasicOptionsState = {
        isMe: false,
        showInviteButton: false,
        showInsertPillButton: false,
        readReceiptButtonDisabled: false,
        onInsertPillButton: () => jest.fn(),
        onReadReceiptButton: () => jest.fn(),
        onShareUserClick: () => jest.fn(),
        onInviteUserButton: (fallbackRoomId: string, evt: Event) => Promise.resolve(),
        onOpenDmForUser: (member: Member) => Promise.resolve(),
    };

    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    let defaultRoom: Room;

    let defaultProps: { member: User | RoomMember; room: Room };

    beforeEach(() => {
        const matrixClient = stubClient();
        defaultRoom = mkStubRoom(defaultRoomId, defaultRoomId, matrixClient);
        defaultProps = {
            member: defaultMember,
            room: defaultRoom,
        };
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should always display sharedButton when user is not me", () => {
        // User is not me by default
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({ ...defaultValue });
        render(<UserInfoBasicOptionsView {...defaultProps} />);
        const sharedButton = screen.getByRole("button", { name: "Share profile" });
        expect(sharedButton).toBeInTheDocument();
    });

    it("should always display sharedButton when user is me", () => {
        const propsWithMe = { ...defaultProps };
        const onShareUserClick = jest.fn();
        const state = { ...defaultValue, isMe: true, onShareUserClick };

        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue(state);
        render(<UserInfoBasicOptionsView {...propsWithMe} />);

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
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue(state);
        render(<UserInfoBasicOptionsView {...defaultProps} />);

        const insertPillButton = screen.getByRole("button", { name: "Mention" });
        expect(insertPillButton).toBeInTheDocument();

        // clicking on the insert pill button
        fireEvent.click(insertPillButton);

        expect(onInsertPillButton).toHaveBeenCalled();
    });

    it("should not show insert pill button when user is not me and showinsertpill is false", () => {
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({ ...defaultValue, showInsertPillButton: false });
        render(<UserInfoBasicOptionsView {...defaultProps} />);
        const insertPillButton = screen.queryByRole("button", { name: "Mention" });
        expect(insertPillButton).not.toBeInTheDocument();
    });

    it("should not show insert pill button when user is me", () => {
        // User is me, should not see the insert button even when show insertpill is true
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({
            ...defaultValue,
            showInsertPillButton: true,
            isMe: true,
        });
        const propsWithMe = { ...defaultProps };
        render(<UserInfoBasicOptionsView {...propsWithMe} />);
        const insertPillButton = screen.queryByRole("button", { name: "Mention" });
        expect(insertPillButton).not.toBeInTheDocument();
    });

    it("should not show readreceiptbutton when user is me", () => {
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({
            ...defaultValue,
            readReceiptButtonDisabled: true,
            isMe: true,
        });
        const propsWithMe = { ...defaultProps };
        render(<UserInfoBasicOptionsView {...propsWithMe} />);

        const readReceiptButton = screen.queryByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).not.toBeInTheDocument();
    });

    it("should show disable readreceiptbutton when readReceiptButtonDisabled is true", () => {
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({ ...defaultValue, readReceiptButtonDisabled: true });
        render(<UserInfoBasicOptionsView {...defaultProps} />);

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).toBeDisabled();
    });

    it("should not show disable readreceiptbutton when readReceiptButtonDisabled is false", () => {
        const onReadReceiptButton = jest.fn();
        const state = { ...defaultValue, readReceiptButtonDisabled: false, onReadReceiptButton };
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue(state);
        render(<UserInfoBasicOptionsView {...defaultProps} />);

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });
        expect(readReceiptButton).not.toBeDisabled();

        // clicking on the read receipt button
        fireEvent.click(readReceiptButton);

        expect(onReadReceiptButton).toHaveBeenCalled();
    });

    it("should show not show invite button if shouldShowComponent is false", () => {
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({ ...defaultValue, showInviteButton: true });
        mocked(shouldShowComponent).mockReturnValue(false);
        render(<UserInfoBasicOptionsView {...defaultProps} />);

        const inviteButton = screen.queryByRole("button", { name: "Invite" });
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(inviteButton).not.toBeInTheDocument();
    });

    it("should show show invite button if shouldShowComponent is true", () => {
        const onInviteUserButton = jest.fn();
        const state = { ...defaultValue, showInviteButton: true, onInviteUserButton };
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue(state);
        mocked(shouldShowComponent).mockReturnValue(true);
        render(<UserInfoBasicOptionsView {...defaultProps} />);

        const inviteButton = screen.getByRole("button", { name: "Invite" });
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(inviteButton).toBeInTheDocument();

        // clicking on the invite button
        fireEvent.click(inviteButton);
        expect(onInviteUserButton).toHaveBeenCalled();
    });

    it("should show directMessageButton when user is not me", () => {
        // User is not me, direct message button should display
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue(defaultValue);
        mocked(shouldShowComponent).mockReturnValue(true);
        render(<UserInfoBasicOptionsView {...defaultProps} />);
        const dmButton = screen.getByRole("button", { name: "Send message" });
        expect(dmButton).toBeInTheDocument();
    });

    it("should not show directMessageButton when user is me", () => {
        mocked(useUserInfoBasicOptionsViewModel).mockReturnValue({ ...defaultValue, isMe: true });
        mocked(shouldShowComponent).mockReturnValue(true);
        const propsWithMe = { ...defaultProps };
        render(<UserInfoBasicOptionsView {...propsWithMe} />);
        const dmButton = screen.queryByRole("button", { name: "Send message" });
        expect(dmButton).not.toBeInTheDocument();
    });
});
