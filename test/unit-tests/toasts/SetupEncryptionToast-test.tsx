/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import ToastContainer from "../../../src/components/structures/ToastContainer";
import { Kind, showToast } from "../../../src/toasts/SetupEncryptionToast";
import dis from "../../../src/dispatcher/dispatcher";
import DeviceListener from "../../../src/DeviceListener";

jest.mock("../../../src/dispatcher/dispatcher", () => ({
    dispatch: jest.fn(),
    register: jest.fn(),
    unregister: jest.fn(),
}));

describe("SetupEncryptionToast", () => {
    beforeEach(() => {
        render(<ToastContainer />);
    });

    it("should render the 'set up recovery' toast", async () => {
        showToast(Kind.SET_UP_RECOVERY);

        await expect(await screen.findByRole("heading", { name: "Set up recovery" })).toBeInTheDocument();
    });

    it("should dismiss toast when 'not now' button clicked", async () => {
        jest.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

        showToast(Kind.SET_UP_RECOVERY);

        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Not now" }));

        expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
    });

    it("should render the 'key storage out of sync' toast", async () => {
        showToast(Kind.KEY_STORAGE_OUT_OF_SYNC);

        await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
    });

    it("should open settings to the reset flow when 'forgot recovery key' clicked", async () => {
        showToast(Kind.KEY_STORAGE_OUT_OF_SYNC);

        const user = userEvent.setup();
        await user.click(await screen.findByText("Forgot recovery key?"));

        expect(dis.dispatch).toHaveBeenCalledWith({
            action: "view_user_settings",
            initialTabId: "USER_ENCRYPTION_TAB",
            props: { showResetIdentity: true },
        });
    });
});
