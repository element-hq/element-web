/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type DeleteKeyStorageViewSnapshot,
    type DeleteKeyStorageViewModel as DeleteKeyStorageViewModelInterface,
} from "@element-hq/web-shared-components";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import {
    DeviceListener,
    ACCOUNT_DATA_KEY_M_KEY_BACKUP,
    ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE,
} from "../../device-listener";

interface DeleteKeyStorageViewModelProps {
    /**
     * The client whose key storage is deleted.
     */
    matrixClient: MatrixClient;
    /**
     * Called when the dialog should close, either after deleting key storage or because the user backed out.
     */
    onFinished: () => void;
}

/**
 * ViewModel for the dialog confirming that the user wants to delete key storage.
 *
 * The dialog stays open until the deletion has finished, so the user cannot change key storage
 * again while the account is in an intermediate state.
 */
export class DeleteKeyStorageViewModel
    extends BaseViewModel<DeleteKeyStorageViewSnapshot, DeleteKeyStorageViewModelProps>
    implements DeleteKeyStorageViewModelInterface
{
    public constructor(props: DeleteKeyStorageViewModelProps) {
        super(props, { busy: false, failed: false });
    }

    public confirm = async (): Promise<void> => {
        if (this.snapshot.current.busy) return;
        this.snapshot.merge({ busy: true, failed: false });
        try {
            // Suppress device listener toasts while the account passes through intermediate states
            await DeviceListener.sharedInstance().whilePaused(this.deleteKeyStorage);
        } catch (e) {
            logger.error("Failed to delete key storage", e);
            this.snapshot.merge({ busy: false, failed: true });
            return;
        }
        this.snapshot.merge({ busy: false });
        this.props.onFinished();
    };

    /**
     * Records in account data that the user wants key storage off, then deletes the key backup,
     * server-side recovery keys and other server-side crypto data.
     *
     * The account data goes first, so a failure part-way leaves key storage wanted off but still
     * present, which a retry completes, rather than deleted but still wanted on.
     */
    private deleteKeyStorage = async (): Promise<void> => {
        const { matrixClient } = this.props;
        const crypto = matrixClient.getCrypto();
        if (!crypto) throw new Error("No crypto module available");

        logger.info("User requested disabling key backup");
        await Promise.all([
            matrixClient.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP, { enabled: false }),
            matrixClient.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE, { disabled: true }),
        ]);
        await crypto.disableKeyStorage();
    };

    public cancel = (): void => {
        // Closing mid-deletion would let the user act on a half-deleted key storage
        if (this.snapshot.current.busy) return;
        this.props.onFinished();
    };
}
