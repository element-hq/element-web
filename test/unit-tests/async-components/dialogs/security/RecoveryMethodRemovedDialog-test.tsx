/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "jest-matrix-react";

import RecoveryMethodRemovedDialog from "../../../../../src/async-components/views/dialogs/security/RecoveryMethodRemovedDialog";
import Modal from "../../../../../src/Modal.tsx";

describe("<RecoveryMethodRemovedDialog />", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should open CreateKeyBackupDialog on primary action click", async () => {
        const onFinished = jest.fn();
        const spy = jest.spyOn(Modal, "createDialog");
        jest.mock("../../../../../src/async-components/views/dialogs/security/CreateKeyBackupDialog", () => ({
            __test: true,
            __esModule: true,
            default: () => <span>mocked dialog</span>,
        }));

        render(<RecoveryMethodRemovedDialog onFinished={onFinished} />);
        fireEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
        expect((spy.mock.lastCall![0] as any)._payload._result).toEqual(expect.objectContaining({ __test: true }));
    });
});
