/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import ChangePassword from "../../../../../src/components/views/settings/ChangePassword";
import { stubClient } from "../../../../test-utils";

describe("<ChangePassword />", () => {
    it("renders expected fields", () => {
        const onFinished = jest.fn();
        const onError = jest.fn();
        const { asFragment } = render(<ChangePassword onFinished={onFinished} onError={onError} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should show validation tooltip if passwords do not match", async () => {
        const onFinished = jest.fn();
        const onError = jest.fn();
        const { getByLabelText, getByText } = render(<ChangePassword onFinished={onFinished} onError={onError} />);

        const currentPasswordField = getByLabelText("Current password");
        await userEvent.type(currentPasswordField, "CurrentPassword1234");

        const newPasswordField = getByLabelText("New Password");
        await userEvent.type(newPasswordField, "$%newPassword1234");
        const confirmPasswordField = getByLabelText("Confirm password");
        await userEvent.type(confirmPasswordField, "$%newPassword1235");

        await userEvent.click(getByText("Change Password"));

        await expect(screen.findByText("Passwords don't match")).resolves.toBeInTheDocument();
    });

    it("should call MatrixClient::setPassword with expected parameters", async () => {
        const cli = stubClient();
        mocked(cli.setPassword).mockResolvedValue({});

        const onFinished = jest.fn();
        const onError = jest.fn();
        const { getByLabelText, getByText } = render(<ChangePassword onFinished={onFinished} onError={onError} />);

        const currentPasswordField = getByLabelText("Current password");
        await userEvent.type(currentPasswordField, "CurrentPassword1234");

        const newPasswordField = getByLabelText("New Password");
        await userEvent.type(newPasswordField, "$%newPassword1234");
        const confirmPasswordField = getByLabelText("Confirm password");
        await userEvent.type(confirmPasswordField, "$%newPassword1234");

        await userEvent.click(getByText("Change Password"));

        await waitFor(() => {
            expect(cli.setPassword).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "m.login.password",
                    identifier: {
                        type: "m.id.user",
                        user: cli.getUserId(),
                    },
                    password: "CurrentPassword1234",
                }),
                "$%newPassword1234",
                false,
            );
        });
        expect(onFinished).toHaveBeenCalled();
    });
});
