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

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { RendezvousFailureReason } from "matrix-js-sdk/src/rendezvous";

import LoginWithQRFlow from "../../../../../src/components/views/auth/LoginWithQRFlow";
import { Click, Phase } from "../../../../../src/components/views/auth/LoginWithQR";

describe("<LoginWithQRFlow />", () => {
    const onClick = jest.fn();

    const defaultProps = {
        onClick,
    };

    const getComponent = (props: {
        phase: Phase;
        onClick?: () => Promise<void>;
        failureReason?: RendezvousFailureReason;
        code?: string;
        confirmationDigits?: string;
    }) => <LoginWithQRFlow {...defaultProps} {...props} />;

    beforeEach(() => {});

    afterEach(() => {
        onClick.mockReset();
        cleanup();
    });

    it("renders spinner while loading", async () => {
        const { container } = render(getComponent({ phase: Phase.Loading }));
        expect(container).toMatchSnapshot();
    });

    it("renders spinner whilst QR generating", async () => {
        const { container } = render(getComponent({ phase: Phase.ShowingQR }));
        expect(screen.getAllByTestId("cancel-button")).toHaveLength(1);
        expect(container).toMatchSnapshot();
        fireEvent.click(screen.getByTestId("cancel-button"));
        expect(onClick).toHaveBeenCalledWith(Click.Cancel);
    });

    it("renders QR code", async () => {
        const { container } = render(getComponent({ phase: Phase.ShowingQR, code: "mock-code" }));
        // QR code is rendered async so we wait for it:
        await waitFor(() => screen.getAllByAltText("QR Code").length === 1);
        expect(container).toMatchSnapshot();
    });

    it("renders spinner while connecting", async () => {
        const { container } = render(getComponent({ phase: Phase.Connecting }));
        expect(screen.getAllByTestId("cancel-button")).toHaveLength(1);
        expect(container).toMatchSnapshot();
        fireEvent.click(screen.getByTestId("cancel-button"));
        expect(onClick).toHaveBeenCalledWith(Click.Cancel);
    });

    it("renders code when connected", async () => {
        const { container } = render(getComponent({ phase: Phase.Connected, confirmationDigits: "mock-digits" }));
        expect(screen.getAllByText("mock-digits")).toHaveLength(1);
        expect(screen.getAllByTestId("decline-login-button")).toHaveLength(1);
        expect(screen.getAllByTestId("approve-login-button")).toHaveLength(1);
        expect(container).toMatchSnapshot();
        fireEvent.click(screen.getByTestId("decline-login-button"));
        expect(onClick).toHaveBeenCalledWith(Click.Decline);
        fireEvent.click(screen.getByTestId("approve-login-button"));
        expect(onClick).toHaveBeenCalledWith(Click.Approve);
    });

    it("renders spinner while signing in", async () => {
        const { container } = render(getComponent({ phase: Phase.WaitingForDevice }));
        expect(screen.getAllByTestId("cancel-button")).toHaveLength(1);
        expect(container).toMatchSnapshot();
        fireEvent.click(screen.getByTestId("cancel-button"));
        expect(onClick).toHaveBeenCalledWith(Click.Cancel);
    });

    it("renders spinner while verifying", async () => {
        const { container } = render(getComponent({ phase: Phase.Verifying }));
        expect(container).toMatchSnapshot();
    });

    describe("errors", () => {
        for (const failureReason of Object.values(RendezvousFailureReason)) {
            it(`renders ${failureReason}`, async () => {
                const { container } = render(
                    getComponent({
                        phase: Phase.Error,
                        failureReason,
                    }),
                );
                expect(screen.getAllByTestId("cancellation-message")).toHaveLength(1);
                expect(screen.getAllByTestId("try-again-button")).toHaveLength(1);
                expect(container).toMatchSnapshot();
                fireEvent.click(screen.getByTestId("try-again-button"));
                expect(onClick).toHaveBeenCalledWith(Click.TryAgain);
            });
        }
    });
});
