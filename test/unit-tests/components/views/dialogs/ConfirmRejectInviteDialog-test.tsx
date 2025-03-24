/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import SdkConfig from "../../../../../src/SdkConfig";
import { ConfirmRejectInviteDialog } from "../../../../../src/components/views/dialogs/ConfirmRejectInviteDialog";

describe("ConfirmRejectInviteDialog", () => {
    const onFinished: jest.Mock<any, any> = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterEach(() => {
        SdkConfig.reset();
    });

    it("can close the dialog", async () => {
        const { getByTestId } = render(<ConfirmRejectInviteDialog onFinished={onFinished} promptOptions />);
        await userEvent.click(getByTestId("dialog-cancel-button"));
        expect(onFinished).toHaveBeenCalledWith(false, false, false);
    });

    it("can hide safety options", async () => {
        const { container, getByRole } = render(
            <ConfirmRejectInviteDialog onFinished={onFinished} promptOptions={false} />,
        );
        expect(container).toMatchSnapshot();
        await userEvent.click(getByRole("button", { name: "Reject invite" }));
        expect(onFinished).toHaveBeenCalledWith(true, false, false);
    });

    it("can reject with options selected", async () => {
        const { container, getByLabelText, getByRole } = render(
            <ConfirmRejectInviteDialog onFinished={onFinished} promptOptions />,
        );
        await userEvent.click(getByLabelText("Ignore user"));
        await userEvent.click(getByLabelText("Report room"));
        await userEvent.type(getByLabelText("Reason"), "I want to report this room");
        expect(container).toMatchSnapshot();
        await userEvent.click(getByRole("button", { name: "Reject invite" }));
        expect(onFinished).toHaveBeenCalledWith(true, true, "I want to report this room");
    });
    it("can reject without a reason", async () => {
        const { getByLabelText, getByRole } = render(
            <ConfirmRejectInviteDialog onFinished={onFinished} promptOptions />,
        );
        await userEvent.click(getByLabelText("Ignore user"));
        await userEvent.click(getByLabelText("Report room"));
        await userEvent.click(getByRole("button", { name: "Reject invite" }));
        expect(onFinished).toHaveBeenCalledWith(true, true, "");
    });
});
