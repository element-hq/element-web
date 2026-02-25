/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "jest-matrix-react";

import RecoveryMethodRemovedDialog from "../../../../../src/async-components/views/dialogs/security/RecoveryMethodRemovedDialog";
import dispatch from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { UserTab } from "../../../../../src/components/views/dialogs/UserTab";

describe("<RecoveryMethodRemovedDialog />", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should open CreateKeyBackupDialog on primary action click", async () => {
        const onFinished = jest.fn();
        jest.spyOn(dispatch, "dispatch");

        render(<RecoveryMethodRemovedDialog onFinished={onFinished} />);
        fireEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        await waitFor(() =>
            expect(dispatch.dispatch).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
            }),
        );
    });
});
