/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import ChangePassword from "../../../../src/components/views/settings/ChangePassword";
import { stubClient } from "../../../test-utils";

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
