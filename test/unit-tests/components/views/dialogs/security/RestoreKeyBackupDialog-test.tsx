/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 *
 */

import React from "react";
import { screen, render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
// Needed to be able to mock decodeRecoveryKey
// eslint-disable-next-line no-restricted-imports
import * as recoveryKeyModule from "matrix-js-sdk/src/crypto-api/recovery-key";

import RestoreKeyBackupDialog from "../../../../../../src/components/views/dialogs/security/RestoreKeyBackupDialog.tsx";
import { stubClient } from "../../../../../test-utils";

describe("<RestoreKeyBackupDialog />", () => {
    beforeEach(() => {
        stubClient();
        jest.spyOn(recoveryKeyModule, "decodeRecoveryKey").mockReturnValue(new Uint8Array(32));
    });

    it("should render", async () => {
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={jest.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Security Key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display an error when recovery key is invalid", async () => {
        jest.spyOn(recoveryKeyModule, "decodeRecoveryKey").mockImplementation(() => {
            throw new Error("Invalid recovery key");
        });
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={jest.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Security Key")).toBeInTheDocument());

        await userEvent.type(screen.getByRole("textbox"), "invalid key");
        await waitFor(() => expect(screen.getByText("👎 Not a valid Security Key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not raise an error when recovery is valid", async () => {
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={jest.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Security Key")).toBeInTheDocument());

        await userEvent.type(screen.getByRole("textbox"), "valid key");
        await waitFor(() => expect(screen.getByText("👍 This looks like a valid Security Key!")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });
});
