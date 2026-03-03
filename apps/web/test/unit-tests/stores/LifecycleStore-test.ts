/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { SyncState } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import ToastStore from "../../../src/stores/ToastStore";
import { stubClient } from "../../test-utils";
import LifecycleStore from "../../../src/stores/LifecycleStore";

describe("LifecycleStore", () => {
    stubClient();
    const client = MatrixClientPeg.safeGet();
    let addOrReplaceToast: jest.SpyInstance;

    beforeEach(() => {
        addOrReplaceToast = jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
    });

    it("should do nothing if the matrix server version is supported", async () => {
        mocked(client).isVersionSupported.mockResolvedValue(true);

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
        mocked(client).isVersionSupported.mockResolvedValue(false);

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
        const dismissToast = jest.spyOn(ToastStore.sharedInstance(), "dismissToast");
        mocked(client).isVersionSupported.mockResolvedValue(false);

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
