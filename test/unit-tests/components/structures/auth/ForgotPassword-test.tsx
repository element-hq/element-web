/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, type RenderResult, screen, waitFor, cleanup } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, createClient } from "matrix-js-sdk/src/matrix";

import ForgotPassword from "../../../../../src/components/structures/auth/ForgotPassword";
import { type ValidatedServerConfig } from "../../../../../src/utils/ValidatedServerConfig";
import { clearAllModals, filterConsole, stubClient, waitEnoughCyclesForModal } from "../../../../test-utils";
import AutoDiscoveryUtils from "../../../../../src/utils/AutoDiscoveryUtils";

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

    const typeIntoField = async (label: string, value: string): Promise<void> => {
        await userEvent.type(screen.getByLabelText(label), value, { delay: null });
    };

    const click = async (element: Element): Promise<void> => {
        await userEvent.click(element, { delay: null });
    };

    const itShouldCloseTheDialogAndShowThePasswordInput = (): void => {
        it("should close the dialog and show the password input", async () => {
            await waitFor(() => expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument());
            expect(screen.getByText("Reset your password")).toBeInTheDocument();
        });
    };

    filterConsole(
        // not implemented by js-dom https://github.com/jsdom/jsdom/issues/1937
        "Not implemented: HTMLFormElement.prototype.requestSubmit",
    );

    beforeEach(() => {
        client = stubClient();
        mocked(createClient).mockReturnValue(client);

        serverConfig = { hsName: "example.com" } as ValidatedServerConfig;

        onComplete = jest.fn();
        onLoginClick = jest.fn();

        jest.spyOn(AutoDiscoveryUtils, "validateServerConfigWithStaticUrls").mockResolvedValue(serverConfig);
        jest.spyOn(AutoDiscoveryUtils, "authComponentStateForError");
    });

    afterEach(async () => {
        // clean up modals
        await clearAllModals();
        cleanup();
    });

    describe("when starting a password reset flow", () => {
        beforeEach(() => {
            renderResult = render(
                <ForgotPassword serverConfig={serverConfig} onComplete={onComplete} onLoginClick={onLoginClick} />,
            );
        });

        it("should show the email input and mention the homeserver", () => {
            expect(screen.queryByLabelText("Email address")).toBeInTheDocument();
            expect(screen.queryByText("example.com")).toBeInTheDocument();
        });

        describe("and updating the server config", () => {
            beforeEach(() => {
                serverConfig.hsName = "example2.com";
                renderResult.rerender(
                    <ForgotPassword serverConfig={serverConfig} onComplete={onComplete} onLoginClick={onLoginClick} />,
                );
            });

            it("should show the new homeserver server name", () => {
                expect(screen.queryByText("example2.com")).toBeInTheDocument();
            });
        });

        describe("and clicking »Sign in instead«", () => {
            beforeEach(async () => {
                await click(screen.getByText("Sign in instead"));
            });

            it("should call onLoginClick()", () => {
                expect(onLoginClick).toHaveBeenCalled();
            });
        });

        describe("and entering a non-email value", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", "not en email");
            });

            it("should show a message about the wrong format", async () => {
                await expect(
                    screen.findByText("The email address doesn't appear to be valid."),
                ).resolves.toBeInTheDocument();
            });
        });

        describe("and submitting an unknown email", () => {
            beforeEach(async () => {
                mocked(AutoDiscoveryUtils.validateServerConfigWithStaticUrls).mockResolvedValue(serverConfig);
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockRejectedValue({
                    errcode: "M_THREEPID_NOT_FOUND",
                });
                await click(screen.getByText("Send email"));
            });

            it("should show an email not found message", async () => {
                await expect(screen.findByText("This email address was not found")).resolves.toBeInTheDocument();
            });
        });

        describe("and a connection error occurs", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockRejectedValue({
                    name: "ConnectionError",
                });
                await click(screen.getByText("Send email"));
            });

            it("should show an info about that", async () => {
                await expect(
                    screen.findByText(
                        "Cannot reach homeserver: Ensure you have a stable internet connection, or get in touch with the server admin",
                    ),
                ).resolves.toBeInTheDocument();
            });
        });

        describe("and the server liveness check fails", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(AutoDiscoveryUtils.validateServerConfigWithStaticUrls).mockRejectedValue({});
                mocked(AutoDiscoveryUtils.authComponentStateForError).mockReturnValue({
                    serverErrorIsFatal: true,
                    serverIsAlive: false,
                    serverDeadError: "server down",
                });
                await click(screen.getByText("Send email"));
            });

            it("should show the server error", async () => {
                await expect(screen.findByText("server down")).resolves.toBeInTheDocument();
            });
        });

        describe("and submitting an known email", () => {
            beforeEach(async () => {
                await typeIntoField("Email address", testEmail);
                mocked(client).requestPasswordEmailToken.mockResolvedValue({
                    sid: testSid,
                });
                await click(screen.getByText("Send email"));
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

            describe("and clicking »Re-enter email address«", () => {
                beforeEach(async () => {
                    await click(screen.getByText("Re-enter email address"));
                });

                it("go back to the email input", () => {
                    expect(screen.queryByText("Enter your email to reset password")).toBeInTheDocument();
                });
            });

            describe("and clicking »Resend«", () => {
                beforeEach(async () => {
                    await click(screen.getByText("Resend"));
                });

                it("should should resend the mail and show the tooltip", () => {
                    expect(client.requestPasswordEmailToken).toHaveBeenCalledWith(
                        testEmail,
                        expect.any(String),
                        2, // second send attempt
                    );
                    expect(
                        screen.getByRole("tooltip", { name: "Verification link email resent!" }),
                    ).toBeInTheDocument();
                });
            });

            describe("and clicking »Next«", () => {
                beforeEach(async () => {
                    await click(screen.getByText("Next"));
                });

                it("should show the password input view", () => {
                    expect(screen.getByText("Reset your password")).toBeInTheDocument();
                });

                describe("and entering different passwords", () => {
                    beforeEach(async () => {
                        await typeIntoField("New Password", testPassword);
                        await typeIntoField("Confirm new password", testPassword + "asd");
                    });

                    it("should show an info about that", async () => {
                        await expect(
                            screen.findByText("New passwords must match each other."),
                        ).resolves.toBeInTheDocument();
                    });
                });

                describe("and entering a new password", () => {
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
                            await click(screen.getByText("Reset password"));
                        });

                        it("should show the rate limit error message", () => {
                            expect(
                                screen.getByText("Too many attempts in a short time. Retry after 13:37."),
                            ).toBeInTheDocument();
                        });
                    });

                    describe("and confirm the email link and submitting the new password", () => {
                        beforeEach(async () => {
                            // fake link confirmed by resolving client.setPassword instead of raising an error
                            mocked(client.setPassword).mockResolvedValue({});
                            await click(screen.getByText("Reset password"));
                        });

                        it("should send the new password (once)", async () => {
                            expect(client.setPassword).toHaveBeenCalledWith(
                                {
                                    type: "m.login.email.identity",
                                    threepid_creds: {
                                        client_secret: expect.any(String),
                                        sid: testSid,
                                    },
                                },
                                testPassword,
                                false,
                            );

                            // it should not retry to set the password
                            await waitFor(() => expect(client.setPassword).toHaveBeenCalledTimes(1));
                        });
                    });

                    describe("and submitting it", () => {
                        beforeEach(async () => {
                            await click(screen.getByText("Reset password"));
                            await waitEnoughCyclesForModal();
                        });

                        it("should send the new password and show the click validation link dialog", async () => {
                            expect(client.setPassword).toHaveBeenCalledWith(
                                {
                                    type: "m.login.email.identity",
                                    threepid_creds: {
                                        client_secret: expect.any(String),
                                        sid: testSid,
                                    },
                                },
                                testPassword,
                                false,
                            );
                            await expect(
                                screen.findByText("Verify your email to continue"),
                            ).resolves.toBeInTheDocument();
                            expect(screen.getByText(testEmail)).toBeInTheDocument();
                        });

                        describe("and dismissing the dialog by clicking the background", () => {
                            beforeEach(async () => {
                                await userEvent.click(await screen.findByTestId("dialog-background"), { delay: null });
                                await waitEnoughCyclesForModal({
                                    useFakeTimers: true,
                                });
                            });

                            itShouldCloseTheDialogAndShowThePasswordInput();
                        });

                        describe("and dismissing the dialog", () => {
                            beforeEach(async () => {
                                await click(await screen.findByLabelText("Close dialog"));
                                await waitEnoughCyclesForModal({
                                    useFakeTimers: true,
                                });
                            });

                            itShouldCloseTheDialogAndShowThePasswordInput();
                        });

                        describe("and clicking »Re-enter email address«", () => {
                            beforeEach(async () => {
                                await click(await screen.findByText("Re-enter email address"));
                                await waitEnoughCyclesForModal({
                                    useFakeTimers: true,
                                });
                            });

                            it("should close the dialog and go back to the email input", async () => {
                                await waitFor(() =>
                                    expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument(),
                                );
                                expect(screen.queryByText("Enter your email to reset password")).toBeInTheDocument();
                            });
                        });
                    });

                    describe("and validating the link from the mail", () => {
                        beforeEach(async () => {
                            mocked(client.setPassword).mockResolvedValue({});
                            await click(screen.getByText("Reset password"));
                            // flush promises for the modal to disappear
                            await waitEnoughCyclesForModal();
                            await waitEnoughCyclesForModal();
                        });

                        it("should display the confirm reset view and now show the dialog", async () => {
                            await expect(
                                screen.findByText("Your password has been reset."),
                            ).resolves.toBeInTheDocument();
                            expect(screen.queryByText("Verify your email to continue")).not.toBeInTheDocument();
                        });
                    });

                    describe("and clicking »Sign out of all devices« and »Reset password«", () => {
                        beforeEach(async () => {
                            await click(screen.getByText("Sign out of all devices"));
                            await click(screen.getByText("Reset password"));
                        });

                        it("should show the sign out warning dialog", async () => {
                            await expect(
                                screen.findByText(
                                    "Signing out your devices will delete the message encryption keys stored on them, making encrypted chat history unreadable.",
                                ),
                            ).resolves.toBeInTheDocument();

                            // confirm dialog
                            await click(screen.getByText("Continue"));

                            // expect setPassword with logoutDevices = true
                            expect(client.setPassword).toHaveBeenCalledWith(
                                {
                                    type: "m.login.email.identity",
                                    threepid_creds: {
                                        client_secret: expect.any(String),
                                        sid: testSid,
                                    },
                                },
                                testPassword,
                                true,
                            );
                        });
                    });
                });
            });
        });
    });
});
