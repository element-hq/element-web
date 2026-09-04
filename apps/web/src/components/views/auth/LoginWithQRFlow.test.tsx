/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "test-utils-rtl";
import { mockQRCodeRender, resetQRCodeMock, waitForQRCodeRender } from "test-utils/qrcode";
import React from "react";
import { ClientRendezvousFailureReason, MSC4108FailureReason, RendezvousIntent } from "matrix-js-sdk/src/rendezvous";

import LoginWithQRFlow from "./LoginWithQRFlow";
import { type FailureReason, LoginWithQRFailureReason } from "./LoginWithQR";
import { Click, Phase } from "./LoginWithQR-types";

vi.mock("qrcode", async () => ({
    ...(await vi.importActual("qrcode")),
    toDataURL: vi.fn(),
}));

describe("<LoginWithQRFlow />", () => {
    const onClick = vi.fn();

    const defaultProps = {
        onClick,
    };

    const getComponent = (props: {
        phase: Phase;
        onClick?: () => Promise<void>;
        failureReason?: FailureReason;
        code?: Uint8Array;
        intent: RendezvousIntent;
    }) => <LoginWithQRFlow {...defaultProps} {...props} />;

    afterEach(() => {
        resetQRCodeMock();
        onClick.mockReset();
        cleanup();
    });

    describe.each([RendezvousIntent.LOGIN_ON_NEW_DEVICE, RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE])(
        "%s",
        (intent) => {
            it("renders spinner while loading", async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.Loading,
                        intent,
                    }),
                );
                expect(container).toMatchSnapshot();
            });

            it("renders spinner whilst QR generating", async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.ShowingQR,
                        intent,
                    }),
                );
                expect(screen.getByTestId("spinner")).toBeVisible();
                expect(container).toMatchSnapshot();
            });

            it("renders QR code", async () => {
                mockQRCodeRender();
                const { container } = render(
                    getComponent({
                        phase: Phase.ShowingQR,
                        code: new TextEncoder().encode("mock-code"),
                        intent,
                    }),
                );
                // QR code is rendered async so we wait for it:
                await waitForQRCodeRender();
                expect(screen.getAllByAltText("QR Code")).toHaveLength(1);
                expect(container).toMatchSnapshot();
            });

            it("renders spinner while signing in", async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.WaitingForDevice,
                        intent,
                    }),
                );
                expect(screen.getAllByTestId("cancel-button")).toHaveLength(1);
                expect(container).toMatchSnapshot();
                fireEvent.click(screen.getByTestId("cancel-button"));
                expect(onClick).toHaveBeenCalledWith(Click.Cancel, undefined);
            });

            it("renders spinner while verifying", async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.Verifying,
                        intent,
                    }),
                );
                expect(container).toMatchSnapshot();
            });

            it("renders check code confirmation", async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.OutOfBandConfirmation,
                        intent,
                    }),
                );
                expect(container).toMatchSnapshot();
            });

            describe("errors", () => {
                for (const failureReason of [
                    ...Object.values(MSC4108FailureReason),
                    ...Object.values(LoginWithQRFailureReason),
                    ...Object.values(ClientRendezvousFailureReason),
                ]) {
                    it(`renders ${failureReason}`, async () => {
                        const { container } = render(
                            getComponent({
                                phase: Phase.Error,
                                failureReason,
                                intent,
                            }),
                        );
                        expect(screen.getAllByTestId("cancellation-message")).toHaveLength(1);
                        expect(container).toMatchSnapshot();
                    });
                }
            });
        },
    );
});
