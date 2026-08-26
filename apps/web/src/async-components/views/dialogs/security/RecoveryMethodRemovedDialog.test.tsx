/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, afterEach, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "test-utils-rtl";

import RecoveryMethodRemovedDialog from "./RecoveryMethodRemovedDialog";
import dispatch from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { UserTab } from "../../../../components/views/dialogs/UserTab";

describe("<RecoveryMethodRemovedDialog />", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should open CreateKeyBackupDialog on primary action click", async () => {
        const onFinished = vi.fn();
        vi.spyOn(dispatch, "dispatch");

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
