/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";

import { EmailInvitationSuccessViewModel } from "./EmailInvitationSuccessViewModel";

describe("EmailInvitationSuccessViewModel", () => {
    it("should expose the emails and close the dialog", () => {
        const closeDialog = vi.fn();
        const vm = new EmailInvitationSuccessViewModel({
            emails: ["alice@example.com", "bob@example.com"],
            closeDialog,
        });
        expect(vm.getSnapshot().emails).toEqual(["alice@example.com", "bob@example.com"]);

        vm.closeDialog();
        expect(closeDialog).toHaveBeenCalled();
    });
});
