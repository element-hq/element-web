/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import Modal from "../../../Modal.tsx";
import { openInviteProgressDialog } from "./InviteProgressDialog.tsx";

describe("openInviteProgressDialog", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should open a dialog which cannot be closed by a background click", () => {
        const close = vi.fn();
        const createDialog = vi
            .spyOn(Modal, "createDialog")
            .mockReturnValue({ close, finished: new Promise(() => {}) });

        const closeDialog = openInviteProgressDialog();

        expect(createDialog).toHaveBeenCalledWith(expect.anything(), {}, undefined, false, false, {
            blockBackgroundClick: true,
        });
        closeDialog();
        expect(close).toHaveBeenCalled();
    });
});
