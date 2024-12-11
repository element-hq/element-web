/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { useEffect, useState } from "react";

import { createCrossSigning } from "../CreateCrossSigning";
import { SdkContextClass } from "../contexts/SDKContext";

type Status = "in_progress" | "complete" | "error" | undefined;

export const useInitialCryptoSetupStatus = (store: InitialCryptoSetupStore): Status => {
    const [status, setStatus] = useState<Status>(store.getStatus());

    useEffect(() => {
        const update = (): void => {
            setStatus(store.getStatus());
        };

        store.on("update", update);

        return () => {
            store.off("update", update);
        };
    }, [store]);

    return status;
};

/**
 * Logic for setting up crypto state that's done immediately after
 * a user registers. Should be transparent to the user, not requiring
 * interaction in most cases.
 * As distinct from SetupEncryptionStore which is for setting up
 * 4S or verifying the device, will always require interaction
 * from the user in some form.
 */
export class InitialCryptoSetupStore extends EventEmitter {
    private status: Status = undefined;

    private client?: MatrixClient;
    private isTokenLogin?: boolean;
    private stores?: SdkContextClass;
    private onFinished?: (success: boolean) => void;

    public static sharedInstance(): InitialCryptoSetupStore {
        if (!window.mxInitialCryptoStore) window.mxInitialCryptoStore = new InitialCryptoSetupStore();
        return window.mxInitialCryptoStore;
    }

    public getStatus(): Status {
        return this.status;
    }

    /**
     * Start the initial crypto setup process.
     *
     * @param {MatrixClient} client The client to use for the setup
     * @param {boolean} isTokenLogin True if the user logged in via a token login, otherwise false
     * @param {SdkContextClass} stores The stores to use for the setup
     */
    public startInitialCryptoSetup(
        client: MatrixClient,
        isTokenLogin: boolean,
        stores: SdkContextClass,
        onFinished: (success: boolean) => void,
    ): void {
        this.client = client;
        this.isTokenLogin = isTokenLogin;
        this.stores = stores;
        this.onFinished = onFinished;

        // We just start this process: it's progress is tracked by the events rather
        // than returning a promise, so we don't bother.
        this.doSetup().catch(() => logger.error("Initial crypto setup failed"));
    }

    /**
     * Retry the initial crypto setup process.
     *
     * If no crypto setup is currently in process, this will return false.
     *
     * @returns {boolean} True if a retry was initiated, otherwise false
     */
    public retry(): boolean {
        if (this.client === undefined || this.isTokenLogin === undefined || this.stores == undefined) return false;

        this.doSetup().catch(() => logger.error("Initial crypto setup failed"));

        return true;
    }

    private reset(): void {
        this.client = undefined;
        this.isTokenLogin = undefined;
        this.stores = undefined;
    }

    private async doSetup(): Promise<void> {
        if (this.client === undefined || this.isTokenLogin === undefined || this.stores == undefined) {
            throw new Error("No setup is in progress");
        }

        const cryptoApi = this.client.getCrypto();
        if (!cryptoApi) throw new Error("No crypto module found!");

        this.status = "in_progress";
        this.emit("update");

        try {
            await createCrossSigning(this.client, this.isTokenLogin, this.stores.accountPasswordStore.getPassword());

            const backupInfo = await cryptoApi.getKeyBackupInfo();
            if (backupInfo === null) {
                await cryptoApi.resetKeyBackup();
            }

            this.reset();

            this.status = "complete";
            this.emit("update");
            this.onFinished?.(true);
        } catch (e) {
            if (this.isTokenLogin) {
                // ignore any failures, we are relying on grace period here
                this.reset();

                this.status = "complete";
                this.emit("update");
                this.onFinished?.(true);

                return;
            }
            logger.error("Error bootstrapping cross-signing", e);
            this.status = "error";
            this.emit("update");
        }
    }
}
