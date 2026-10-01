/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { SyncState } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { stubClient } from "test-utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import ToastStore from "./ToastStore";
import LifecycleStore from "./LifecycleStore";

describe("LifecycleStore", () => {
    stubClient();
    const client = MatrixClientPeg.safeGet();
    let addOrReplaceToast: Mock;

    beforeEach(() => {
        addOrReplaceToast = vi.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
    });

    it("should do nothing if the matrix server version is supported", async () => {
        vi.mocked(client).isVersionSupported.mockResolvedValue(true);

        (LifecycleStore as any).onDispatch({
            action: "MatrixActions.sync",
            state: SyncState.Syncing,
            prevState: SyncState.Prepared,
        });

        await sleep(0);

        expect(addOrReplaceToast).not.toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Your server is unsupported",
            }),
        );
    });

    it("should show a toast if the matrix server version is unsupported", async () => {
        vi.mocked(client).isVersionSupported.mockResolvedValue(false);

        (LifecycleStore as any).onDispatch({
            action: "MatrixActions.sync",
            state: SyncState.Syncing,
            prevState: SyncState.Prepared,
        });

        await sleep(0);

        expect(addOrReplaceToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Your server is unsupported",
            }),
        );
    });

    it("dismisses toast on accept button", async () => {
        const dismissToast = vi.spyOn(ToastStore.sharedInstance(), "dismissToast");
        vi.mocked(client).isVersionSupported.mockResolvedValue(false);

        (LifecycleStore as any).onDispatch({
            action: "MatrixActions.sync",
            state: SyncState.Syncing,
            prevState: SyncState.Prepared,
        });

        await sleep(0);

        addOrReplaceToast.mock.calls[0][0].props.onPrimaryClick();

        expect(dismissToast).toHaveBeenCalledWith(addOrReplaceToast.mock.calls[0][0].key);
    });
});
