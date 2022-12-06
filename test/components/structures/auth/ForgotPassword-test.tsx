/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { mocked } from "jest-mock";
import { act, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient, createClient } from "matrix-js-sdk/src/matrix";

import ForgotPassword from "../../../../src/components/structures/auth/ForgotPassword";
import { ValidatedServerConfig } from "../../../../src/utils/ValidatedServerConfig";
import { filterConsole, flushPromisesWithFakeTimers, stubClient } from "../../../test-utils";
import Modal from "../../../../src/Modal";
import AutoDiscoveryUtils from "../../../../src/utils/AutoDiscoveryUtils";

jest.mock("matrix-js-sdk/src/matrix", () => ({
    ...jest.requireActual("matrix-js-sdk/src/matrix"),
    createClient: jest.fn(),
}));

describe("<ForgotPassword>", () => {
    const testEmail = "user@example.com";
    const testSid = "sid42";
    const testPassword = "cRaZyP4ssw0rd!";
    let client: MatrixClient;
    let serverConfig: ValidatedServerConfig;
    let onComplete: () => void;
    let onLoginClick: () => void;
    let renderResult: RenderResult;
    let restoreConsole: () => void;

    const typeIntoField = async (label: string, value: string): Promise<void> => {
        await act(async () => {
            await userEvent.type(screen.getByLabelText(label), value, { delay: null });
            // the message is shown after some time
            jest.advanceTimersByTime(500);
        });
    };

    const clickButton = async (label: string): Promise<void> => {
        await act(async () => {
            await userEvent.click(screen.getByText(label), { delay: null });
        });
    };

    const itShouldCloseTheDialogAndShowThePasswordInput = (): void => {
        it("should close the dialog and show the password input", () => {
            expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument();
            expect(screen.getByText("Reset your password")).toBeInTheDocument();
        });
    };

    beforeEach(() => {
        restoreConsole = filterConsole(
            // not implemented by js-dom https://github.com/jsdom/jsdom/issues/1937
            "Not implemented: HTMLFormElement.prototype.requestSubmit",
            // not of interested for this test
            "Starting load of AsyncWrapper for modal",
        );

        client = stubClient();
        mocked(createClient).mockReturnValue(client);

        serverConfig = new ValidatedServerConfig();
        serverConfig.hsName = "example.com";

        onComplete = jest.fn();
        onLoginClick = jest.fn();

        jest.spyOn(AutoDiscoveryUtils, "validateServerConfigWithStaticUrls").mockResolvedValue(serverConfig);
        jest.spyOn(AutoDiscoveryUtils, "authComponentStateForError");
    });

    afterEach(() => {
        // clean up modals
        Modal.closeCurrentModal("force");
        restoreConsole?.();
    });

    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe("when starting a password reset flow", () => {
        beforeEach(() => {
            renderResult = render(<ForgotPassword
                serverConfig={serverConfig}
                onComplete={onComplete}
                onLoginClick={onLoginClick}
            />);
        });

        it("should show the email input and mention the homeserver", () => {
            expect(screen.queryByLabelText("Email address")).toBeInTheDocument();
            expect(screen.queryByText("example.com")).toBeInTheDocument();
        });

        describe("and updating the server config", () => {
            beforeEach(() => {
                serverConfig.hsName = "example2.com";
                renderResult.rerender(<ForgotPassword
                    serverConfig={serverConfig}
                    onComplete={onComplete}
                    onLoginClick={onLoginClick}
                />);
            });

            it("should show the new homeserver server name", () => {
                expect(screen.queryByText("example2.com")).toBeInTheDocument();
            });
        });

        describe("when clicking »Sign in instead«", () => {
            beforeEach(async () => {
                await clickButton("Sign in instead");
            });

            it("should call onLoginClick()", () => {
                expect(onLoginClick).toHaveBeenCalled();
            });
        });

        describe("when entering a non-email value", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", "not en email");
            });

            it("should show a message about the wrong format", () => {
                expect(screen.getByText("The email address doesn't appear to be valid.")).toBeInTheDocument();
            });
        });

        describe("when submitting an unknown email", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockRejectedValue({
                    errcode: "M_THREEPID_NOT_FOUND",
                });
                await clickButton("Send email");
            });

            it("should show an email not found message", () => {
                expect(screen.getByText("This email address was not found")).toBeInTheDocument();
            });
        });

        describe("when a connection error occurs", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockRejectedValue({
                    name: "ConnectionError",
                });
                await clickButton("Send email");
            });

            it("should show an info about that", () => {
                expect(screen.getByText(
                    "Cannot reach homeserver: "
                    + "Ensure you have a stable internet connection, or get in touch with the server admin",
                )).toBeInTheDocument();
            });
        });

        describe("when the server liveness check fails", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(AutoDiscoveryUtils.validateServerConfigWithStaticUrls).mockRejectedValue({});
                mocked(AutoDiscoveryUtils.authComponentStateForError).mockReturnValue({
                    serverErrorIsFatal: true,
                    serverIsAlive: false,
                    serverDeadError: "server down",
                });
                await clickButton("Send email");
            });

            it("should show the server error", () => {
                expect(screen.queryByText("server down")).toBeInTheDocument();
            });
        });

        describe("when submitting an known email", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockResolvedValue({
                    sid: testSid,
                });
                await clickButton("Send email");
            });

            it("should send the mail and show the check email view", () => {
                expect(client.requestPasswordEmailToken).toHaveBeenCalledWith(
                    testEmail,
                    expect.any(String),
                    1, // second send attempt
                );
                expect(screen.getByText("Check your email to continue")).toBeInTheDocument();
                expect(screen.getByText(testEmail)).toBeInTheDocument();
            });

            describe("when clicking re-enter email", () => {
                beforeEach(async () => {
                    await clickButton("Re-enter email address");
                });

                it("go back to the email input", () => {
                    expect(screen.queryByText("Enter your email to reset password")).toBeInTheDocument();
                });
            });

            describe("when clicking resend email", () => {
                beforeEach(async () => {
                    await userEvent.click(screen.getByText("Resend"), { delay: null });
                    // the message is shown after some time
                    jest.advanceTimersByTime(500);
                });

                it("should should resend the mail and show the tooltip", () => {
                    expect(client.requestPasswordEmailToken).toHaveBeenCalledWith(
                        testEmail,
                        expect.any(String),
                        2, // second send attempt
                    );
                    expect(screen.getByText("Verification link email resent!")).toBeInTheDocument();
                });
            });

            describe("when clicking next", () => {
                beforeEach(async () => {
                    await clickButton("Next");
                });

                it("should show the password input view", () => {
                    expect(screen.getByText("Reset your password")).toBeInTheDocument();
                });

                describe("when entering different passwords", () => {
                    beforeEach(async () => {
                        await typeIntoField("New Password", testPassword);
                        await typeIntoField("Confirm new password", testPassword + "asd");
                    });

                    it("should show an info about that", () => {
                        expect(screen.getByText("New passwords must match each other.")).toBeInTheDocument();
                    });
                });

                describe("when entering a new password", () => {
                    beforeEach(async () => {
                        mocked(client.setPassword).mockRejectedValue({ httpStatus: 401 });
                        await typeIntoField("New Password", testPassword);
                        await typeIntoField("Confirm new password", testPassword);
                    });

                    describe("and submitting it running into rate limiting", () => {
                        beforeEach(async () => {
                            mocked(client.setPassword).mockRejectedValue({
                                message: "rate limit reached",
                                httpStatus: 429,
                                data: {
                                    retry_after_ms: (13 * 60 + 37) * 1000,
                                },
                            });
                            await clickButton("Reset password");
                        });

                        it("should show the rate limit error message", () => {
                            expect(
                                screen.getByText("Too many attempts in a short time. Retry after 13:37."),
                            ).toBeInTheDocument();
                        });
                    });

                    describe("and submitting it", () => {
                        beforeEach(async () => {
                            await clickButton("Reset password");
                            // double flush promises for the modal to appear
                            await flushPromisesWithFakeTimers();
                            await flushPromisesWithFakeTimers();
                        });

                        it("should send the new password and show the click validation link dialog", () => {
                            expect(client.setPassword).toHaveBeenCalledWith(
                                {
                                    type: "m.login.email.identity",
                                    threepid_creds: {
                                        client_secret: expect.any(String),
                                        sid: testSid,
                                    },
                                    threepidCreds: {
                                        client_secret: expect.any(String),
                                        sid: testSid,
                                    },
                                },
                                testPassword,
                                false,
                            );
                            expect(screen.getByText("Verify your email to continue")).toBeInTheDocument();
                            expect(screen.getByText(testEmail)).toBeInTheDocument();
                        });

                        describe("and dismissing the dialog by clicking the background", () => {
                            beforeEach(async () => {
                                await act(async () => {
                                    await userEvent.click(screen.getByTestId("dialog-background"), { delay: null });
                                });
                                // double flush promises for the modal to disappear
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                            });

                            itShouldCloseTheDialogAndShowThePasswordInput();
                        });

                        describe("and dismissing the dialog", () => {
                            beforeEach(async () => {
                                await act(async () => {
                                    await userEvent.click(screen.getByLabelText("Close dialog"), { delay: null });
                                });
                                // double flush promises for the modal to disappear
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                            });

                            itShouldCloseTheDialogAndShowThePasswordInput();
                        });

                        describe("when clicking re-enter email", () => {
                            beforeEach(async () => {
                                await clickButton("Re-enter email address");
                                // double flush promises for the modal to disappear
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                            });

                            it("should close the dialog and go back to the email input", () => {
                                expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument();
                                expect(screen.queryByText("Enter your email to reset password")).toBeInTheDocument();
                            });
                        });

                        describe("when validating the link from the mail", () => {
                            beforeEach(async () => {
                                mocked(client.setPassword).mockResolvedValue({});
                                // be sure the next set password attempt was sent
                                jest.advanceTimersByTime(3000);
                                // quad flush promises for the modal to disappear
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                                await flushPromisesWithFakeTimers();
                            });

                            it("should display the confirm reset view and now show the dialog", () => {
                                expect(screen.queryByText("Your password has been reset.")).toBeInTheDocument();
                                expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument();
                            });
                        });
                    });
                });
            });
        });
    });
});
