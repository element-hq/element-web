/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { InviteRulesAccountSetting } from "../../../../../../../src/components/views/settings/tabs/user/InviteRulesAccountSettings";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { type ComputedInviteConfig } from "../../../../../../../src/@types/invite-rules";
import { SettingLevel } from "../../../../../../../src/settings/SettingLevel";

function mockSetting(mediaPreviews: ComputedInviteConfig, supported = true) {
    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
        if (settingName === "inviteRules") {
            return mediaPreviews;
        }
        throw Error(`Unexpected setting ${settingName}`);
    });
    jest.spyOn(SettingsStore, "disabledMessage").mockImplementation((settingName) => {
        if (settingName === "inviteRules") {
            return supported ? undefined : "test-not-supported";
        }
        throw Error(`Unexpected setting ${settingName}`);
    });
}

describe("InviteRulesAccountSetting", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not render if not supported", async () => {
        mockSetting({ allBlocked: false }, false);
        const { findByText, findByLabelText } = render(<InviteRulesAccountSetting />);
        const input = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.hover(input);
        const result = await findByText("test-not-supported");
        expect(result).toBeInTheDocument();
    });
    it("renders correct state when invites are not blocked", async () => {
        mockSetting({ allBlocked: false }, true);
        const { findByLabelText } = render(<InviteRulesAccountSetting />);
        const result = await findByLabelText("Allow users to invite you to rooms");
        expect(result).toBeChecked();
    });
    it("renders correct state when invites are blocked", async () => {
        mockSetting({ allBlocked: true }, true);
        const { findByLabelText } = render(<InviteRulesAccountSetting />);
        const result = await findByLabelText("Allow users to invite you to rooms");
        expect(result).not.toBeChecked();
    });
    it("handles disabling all invites", async () => {
        mockSetting({ allBlocked: false }, true);
        jest.spyOn(SettingsStore, "setValue").mockImplementation();
        const { findByLabelText } = render(<InviteRulesAccountSetting />);
        const result = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.click(result);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("inviteRules", null, SettingLevel.ACCOUNT, {
            allBlocked: true,
        });
    });
    it("handles enabling all invites", async () => {
        mockSetting({ allBlocked: true }, true);
        jest.spyOn(SettingsStore, "setValue").mockImplementation();
        const { findByLabelText } = render(<InviteRulesAccountSetting />);
        const result = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.click(result);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("inviteRules", null, SettingLevel.ACCOUNT, {
            allBlocked: false,
        });
    });
});
