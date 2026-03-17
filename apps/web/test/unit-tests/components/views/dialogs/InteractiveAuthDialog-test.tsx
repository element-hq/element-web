/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { MatrixError } from "matrix-js-sdk/src/matrix";

import InteractiveAuthDialog from "../../../../../src/components/views/dialogs/InteractiveAuthDialog";
import { clearAllModals, flushPromises, getMockClientWithEventEmitter, unmockClientPeg } from "../../../../test-utils";

describe("InteractiveAuthDialog", function () {
    const homeserverUrl = "https://matrix.org";
    const authUrl = "https://auth.com";
    const mockClient = getMockClientWithEventEmitter({
        generateClientSecret: jest.fn().mockReturnValue("t35tcl1Ent5ECr3T"),
        getFallbackAuthUrl: jest.fn().mockReturnValue(authUrl),
        getHomeserverUrl: jest.fn().mockReturnValue(homeserverUrl),
    });

    const defaultProps = {
        matrixClient: mockClient,
        makeRequest: jest.fn().mockResolvedValue(undefined),
        onFinished: jest.fn(),
    };

    const renderComponent = (props = {}) => render(<InteractiveAuthDialog {...defaultProps} {...props} />);
    const getPasswordField = () => screen.getByLabelText("Password");
    const getSubmitButton = () => screen.getByRole("button", { name: "Continue" });

    beforeEach(async function () {
        jest.clearAllMocks();
        mockClient.credentials = { userId: null };
        await clearAllModals();
    });

    afterAll(async () => {
        unmockClientPeg();
        await clearAllModals();
    });

    it("Should successfully complete a password flow", async () => {
        const onFinished = jest.fn();
        const makeRequest = jest.fn().mockResolvedValue({ a: 1 });

        mockClient.credentials = { userId: "@user:id" };
        const authData = {
            session: "sess",
            flows: [{ stages: ["m.login.password"] }],
        };

        renderComponent({ makeRequest, onFinished, authData });

        const passwordField = getPasswordField();
        const submitButton = getSubmitButton();

        expect(passwordField).toBeTruthy();
        expect(submitButton).toBeTruthy();

        // submit should be disabled
        expect(submitButton).toBeDisabled();

        // put something in the password box
        await userEvent.type(passwordField, "s3kr3t");

        expect(submitButton).not.toBeDisabled();

        // hit enter; that should trigger a request
        await userEvent.click(submitButton);

        // wait for auth request to resolve
        await flushPromises();

        expect(makeRequest).toHaveBeenCalledTimes(1);
        expect(makeRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                session: "sess",
                type: "m.login.password",
                password: "s3kr3t",
                identifier: {
                    type: "m.id.user",
                    user: "@user:id",
                },
            }),
        );

        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(true, { a: 1 });
    });

    describe("SSO flow", () => {
        it("should close on cancel", () => {
            const onFinished = jest.fn();
            const makeRequest = jest.fn().mockResolvedValue({ a: 1 });

            mockClient.credentials = { userId: "@user:id" };
            const authData = {
                session: "sess",
                flows: [{ stages: ["m.login.sso"] }],
            };

            renderComponent({ makeRequest, onFinished, authData });

            expect(screen.getByText("To continue, use Single Sign On to prove your identity.")).toBeInTheDocument();

            fireEvent.click(screen.getByText("Cancel"));

            expect(onFinished).toHaveBeenCalledWith(false, null);
        });

        it("should complete an sso flow", async () => {
            jest.spyOn(global.window, "addEventListener");
            // @ts-ignore
            jest.spyOn(global.window, "open").mockImplementation(() => {});
            const onFinished = jest.fn();
            const successfulResult = { test: 1 };
            const makeRequest = jest
                .fn()
                .mockRejectedValueOnce(new MatrixError({ flows: [{ stages: ["m.login.sso"] }] }, 401))
                .mockResolvedValue(successfulResult);

            mockClient.credentials = { userId: "@user:id" };
            const authData = {
                session: "sess",
                flows: [{ stages: ["m.login.sso"] }],
            };

            renderComponent({ makeRequest, onFinished, authData });

            await flushPromises();

            expect(screen.getByText("To continue, use Single Sign On to prove your identity.")).toBeInTheDocument();
            fireEvent.click(screen.getByText("Single Sign On"));

            // no we're on the sso auth screen
            expect(screen.getByText("Click the button below to confirm your identity.")).toBeInTheDocument();

            // launch sso
            fireEvent.click(screen.getByText("Confirm"));
            expect(global.window.open).toHaveBeenCalledWith(authUrl, "_blank");

            const onWindowReceiveMessageCall = mocked(window.addEventListener).mock.calls.find(
                (args) => args[0] === "message",
            );
            expect(onWindowReceiveMessageCall).toBeTruthy();
            // get the handle from SSO auth component
            // so we can pretend sso auth was completed
            const onWindowReceiveMessage = onWindowReceiveMessageCall![1];

            // complete sso successfully
            act(() => {
                // @ts-ignore
                onWindowReceiveMessage({ data: "authDone", origin: homeserverUrl });
            });

            // expect(makeRequest).toHaveBeenCalledWith({ session: authData.session })

            // spinner displayed
            expect(screen.getByRole("progressbar")).toBeInTheDocument();
            // cancel/confirm buttons hidden while request in progress
            expect(screen.queryByText("Confirm")).not.toBeInTheDocument();

            await flushPromises();
            await flushPromises();

            // nothing in progress
            expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

            // auth completed, now make the request again with auth
            fireEvent.click(screen.getByText("Confirm"));
            // loading while making request
            expect(screen.getByRole("progressbar")).toBeInTheDocument();

            expect(makeRequest).toHaveBeenCalledTimes(2);

            await flushPromises();

            expect(onFinished).toHaveBeenCalledWith(true, successfulResult);
        });
    });
});
