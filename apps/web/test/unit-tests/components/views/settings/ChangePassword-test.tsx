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
import { MatrixError } from "matrix-js-sdk/src/matrix";

import ChangePassword from "../../../../../src/components/views/settings/ChangePassword";
import { stubClient } from "../../../../test-utils";

jest.mock("../../../../../src/utils/PasswordScorer", () => ({
    scorePassword: jest.fn(() => ({
        score: 4,
        feedback: {
            warning: "",
            suggestions: [],
        },
    })),
}));

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

    /** Fill in a valid password change and submit it, returning the callbacks the form was given. */
    async function submitPasswordChange(): Promise<{ onFinished: jest.Mock; onError: jest.Mock }> {
        const onFinished = jest.fn();
        const onError = jest.fn();
        const { getByLabelText, getByText } = render(<ChangePassword onFinished={onFinished} onError={onError} />);

        await userEvent.type(getByLabelText("Current password"), "CurrentPassword1234");
        await userEvent.type(getByLabelText("New Password"), "$%newPassword1234");
        await userEvent.type(getByLabelText("Confirm password"), "$%newPassword1234");
        await userEvent.click(getByText("Change Password"));

        return { onFinished, onError };
    }

    it("should call MatrixClient::setPassword with expected parameters", async () => {
        const cli = stubClient();
        mocked(cli.setPassword).mockResolvedValue({});

        const { onFinished } = await submitPasswordChange();

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

    it("changes the password when the server answers with a password challenge", async () => {
        const cli = stubClient();
        // A homeserver which ignores an auth object with no session and starts a fresh flow instead.
        mocked(cli.setPassword)
            .mockRejectedValueOnce(
                new MatrixError(
                    { session: "sessionId", flows: [{ stages: ["m.login.password"] }], completed: [] },
                    401,
                ),
            )
            .mockResolvedValueOnce({});

        const { onFinished, onError } = await submitPasswordChange();

        await waitFor(() => expect(onFinished).toHaveBeenCalled());
        expect(cli.setPassword).toHaveBeenLastCalledWith(
            expect.objectContaining({ session: "sessionId", password: "CurrentPassword1234" }),
            "$%newPassword1234",
            false,
        );
        expect(onError).not.toHaveBeenCalled();
    });

    it("reports a challenge the current password cannot answer", async () => {
        const cli = stubClient();
        const error = new MatrixError({ session: "sessionId", flows: [{ stages: ["m.login.sso"] }] }, 401);
        mocked(cli.setPassword).mockRejectedValue(error);

        const { onFinished, onError } = await submitPasswordChange();

        await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
        expect(cli.setPassword).toHaveBeenCalledTimes(1);
        expect(onFinished).not.toHaveBeenCalled();
    });
});
