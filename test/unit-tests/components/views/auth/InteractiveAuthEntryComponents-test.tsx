/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "jest-matrix-react";
import { AuthType } from "matrix-js-sdk/src/interactive-auth";
import userEvent from "@testing-library/user-event";
import { type Policy } from "matrix-js-sdk/src/matrix";

import {
    EmailIdentityAuthEntry,
    MasUnlockCrossSigningAuthEntry,
    TermsAuthEntry,
} from "../../../../../src/components/views/auth/InteractiveAuthEntryComponents";
import { createTestClient } from "../../../../test-utils";

describe("<EmailIdentityAuthEntry/>", () => {
    const renderIdentityAuth = () => {
        const matrixClient = createTestClient();

        return render(
            <EmailIdentityAuthEntry
                matrixClient={matrixClient}
                loginType={AuthType.Email}
                onPhaseChange={jest.fn()}
                submitAuthDict={jest.fn()}
                fail={jest.fn()}
                clientSecret="my secret"
                inputs={{ emailAddress: "alice@example.xyz" }}
            />,
        );
    };

    test("should render", () => {
        const { container } = renderIdentityAuth();
        expect(container).toMatchSnapshot();
    });

    test("should clear the requested state when the button tooltip is hidden", async () => {
        renderIdentityAuth();

        // After a click on the resend button, the button should display the resent label
        screen.getByRole("button", { name: "Resend" }).click();
        await waitFor(() => expect(screen.queryByRole("button", { name: "Resent!" })).toBeInTheDocument());
        expect(screen.queryByRole("button", { name: "Resend" })).toBeNull();

        const resentButton = screen.getByRole("button", { name: "Resent!" });
        // Hover briefly the button and wait for the tooltip to be displayed
        await userEvent.hover(resentButton);
        await waitFor(() => expect(screen.getByRole("tooltip", { name: "Resent!" })).toBeInTheDocument());

        // On unhover, it should display again the resend button
        await act(() => userEvent.unhover(resentButton));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Resend" })).toBeInTheDocument());
    });
});

describe("<MasUnlockCrossSigningAuthEntry/>", () => {
    const renderAuth = (props = {}) => {
        const matrixClient = createTestClient();

        return render(
            <MasUnlockCrossSigningAuthEntry
                matrixClient={matrixClient}
                loginType={AuthType.Email}
                onPhaseChange={jest.fn()}
                submitAuthDict={jest.fn()}
                fail={jest.fn()}
                clientSecret="my secret"
                stageParams={{ url: "https://example.com" }}
                {...props}
            />,
        );
    };

    test("should render", () => {
        const { container } = renderAuth();
        expect(container).toMatchSnapshot();
    });

    test("should open idp in new tab on click", async () => {
        const spy = jest.spyOn(global.window, "open");
        renderAuth();

        fireEvent.click(screen.getByRole("button", { name: "Go to your account" }));
        expect(spy).toHaveBeenCalledWith("https://example.com", "_blank");
    });

    test("should retry uia request on click", async () => {
        const submitAuthDict = jest.fn();
        renderAuth({ submitAuthDict });

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(submitAuthDict).toHaveBeenCalledWith({});
    });
});

describe("<TermsAuthEntry/>", () => {
    const renderAuth = (policy: Policy, props = {}) => {
        const matrixClient = createTestClient();

        return render(
            <TermsAuthEntry
                matrixClient={matrixClient}
                loginType={AuthType.Email}
                onPhaseChange={jest.fn()}
                submitAuthDict={jest.fn()}
                fail={jest.fn()}
                clientSecret="my secret"
                stageParams={{
                    policies: {
                        test_policy: policy,
                    },
                }}
                {...props}
            />,
        );
    };

    test("should render", () => {
        const { container } = renderAuth({
            version: "alpha",
            en: {
                name: "Test Policy",
                url: "https://example.com/en",
            },
        });
        expect(container).toMatchSnapshot();
    });
});
