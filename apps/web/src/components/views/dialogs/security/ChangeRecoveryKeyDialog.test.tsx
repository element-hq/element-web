/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { getMockClientWithEventEmitter, mockClientMethodsCrypto, mockClientMethodsUser } from "test-utils";
import { ChangeRecoveryKeyDialog } from "./ChangeRecoveryKeyDialog";

// Mock the ChangeRecoveryKeyBody component to avoid testing its implementation details in this test suite.
vi.mock("../../settings/encryption/ChangeRecoveryKeyBody", () => ({
    ChangeRecoveryKeyBody: (props: {
        userHasRecoveryKey: boolean;
        onFinish: () => void;
        onCancelClick: () => void;
    }) => (
        <div>
            <span>{`ChangeRecoveryKeyBody userHasRecoveryKey=${props.userHasRecoveryKey}`}</span>
            <button onClick={props.onFinish}>Stub finish</button>
            <button onClick={props.onCancelClick}>Stub cancel</button>
        </div>
    ),
}));

describe("<ChangeRecoveryKeyDialog />", () => {
    beforeEach(() => {
        getMockClientWithEventEmitter({
            ...mockClientMethodsCrypto(),
            ...mockClientMethodsUser(),
        });
    });

    function renderComponent(userHasRecoveryKey = false, onFinished = vi.fn()) {
        return render(<ChangeRecoveryKeyDialog userHasRecoveryKey={userHasRecoveryKey} onFinished={onFinished} />);
    }

    it("renders the body in a dialog", () => {
        const { asFragment } = renderComponent();
        expect(screen.getByText("ChangeRecoveryKeyBody userHasRecoveryKey=false")).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Get recovery key" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("uses the change-key label when the user already has a recovery key", () => {
        renderComponent(true);
        expect(screen.getByText("ChangeRecoveryKeyBody userHasRecoveryKey=true")).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Change recovery key" })).toBeInTheDocument();
    });

    it("shows the confirmation screen when the key is changed, and finishes with true on Done", async () => {
        const onFinished = vi.fn();
        const { asFragment } = renderComponent(false, onFinished);
        await userEvent.click(screen.getByRole("button", { name: "Stub finish" }));

        expect(screen.getByText("Your backup is now fully set up")).toBeInTheDocument();
        expect(onFinished).not.toHaveBeenCalled();
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(onFinished).toHaveBeenCalledWith(true);
    });


    it("finishes with false when the body is cancelled", async () => {
        const onFinished = vi.fn();
        renderComponent(false, onFinished);
        await userEvent.click(screen.getByRole("button", { name: "Stub cancel" }));
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
