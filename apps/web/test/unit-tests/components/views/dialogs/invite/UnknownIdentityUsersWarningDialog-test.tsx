/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps } from "react";
import { render, type RenderResult } from "jest-matrix-react";
import { getAllByRole, getAllByText, getByText } from "@testing-library/dom";

import UnknownIdentityUsersWarningDialog from "../../../../../../src/components/views/dialogs/invite/UnknownIdentityUsersWarningDialog.tsx";
import { InviteKind } from "../../../../../../src/components/views/dialogs/InviteDialogTypes.ts";
import { DirectoryMember, ThreepidMember } from "../../../../../../src/utils/direct-messages.ts";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";

describe("UnknownIdentityUsersWarningDialog", () => {
    beforeEach(() => {
        getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should show entries for each user", () => {
        const result = renderComponent({
            users: [
                new DirectoryMember({ user_id: "@alice:example.com" }),
                new DirectoryMember({
                    user_id: "@bob:example.net",
                    display_name: "Bob",
                    avatar_url: "mxc://example.com/abc",
                }),
                new ThreepidMember("charlie@example.com"),
            ],
        });

        const list = result.getByTestId("userlist");
        const entries = getAllByRole(list, "option");
        expect(entries).toHaveLength(3);

        // No displayname so mxid is displayed twice
        expect(getAllByText(entries[0], "@alice:example.com")).toHaveLength(2);

        getByText(entries[1], "Bob");
        getByText(entries[2], "charlie@example.com");
    });

    describe("in DM mode", () => {
        const kind = InviteKind.Dm;

        it("shows a 'Continue' button", () => {
            const onContinue = jest.fn();
            const result = renderComponent({ kind, onContinue });
            const continueButton = result.getByRole("button", { name: "Continue" });
            continueButton.click();
            expect(onContinue).toHaveBeenCalled();
        });

        it("shows a 'Cancel' button", () => {
            const onCancel = jest.fn();
            const result = renderComponent({ kind, onCancel });
            const cancelButton = result.getByRole("button", { name: "Cancel" });
            cancelButton.click();
            expect(onCancel).toHaveBeenCalled();
        });
    });

    describe("in Invite mode", () => {
        const kind = InviteKind.Invite;

        it("shows an 'Invite' button", () => {
            const onContinue = jest.fn();
            const result = renderComponent({ kind, onContinue });
            const continueButton = result.getByRole("button", { name: "Invite" });
            continueButton.click();
            expect(onContinue).toHaveBeenCalled();
        });

        it("shows a 'Remove' button", () => {
            const onRemove = jest.fn();
            const result = renderComponent({ kind, onRemove });
            const removeButton = result.getByRole("button", { name: "Remove" });
            removeButton.click();
            expect(onRemove).toHaveBeenCalled();
        });
    });
});

function renderComponent(props: Partial<ComponentProps<typeof UnknownIdentityUsersWarningDialog>>): RenderResult {
    const props1: ComponentProps<typeof UnknownIdentityUsersWarningDialog> = {
        onContinue: () => {},
        onCancel: () => {},
        onRemove: () => {},
        screenName: undefined,
        kind: InviteKind.Dm,
        users: [],
        ...props,
    };
    return render(<UnknownIdentityUsersWarningDialog {...props1} />);
}
