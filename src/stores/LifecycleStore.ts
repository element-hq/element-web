/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SyncState } from "matrix-js-sdk/src/matrix";
import { MINIMUM_MATRIX_VERSION, SUPPORTED_MATRIX_VERSIONS } from "matrix-js-sdk/src/version-support";
import { logger } from "matrix-js-sdk/src/logger";

import { Action } from "../dispatcher/actions";
import dis from "../dispatcher/dispatcher";
import { type ActionPayload } from "../dispatcher/payloads";
import { type DoAfterSyncPreparedPayload } from "../dispatcher/payloads/DoAfterSyncPreparedPayload";
import { AsyncStore } from "./AsyncStore";
import { MatrixClientPeg } from "../MatrixClientPeg";
import ToastStore from "./ToastStore";
import { _t } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import GenericToast from "../components/views/toasts/GenericToast";

interface IState {
    deferredAction: ActionPayload | null;
}

const INITIAL_STATE: IState = {
    deferredAction: null,
};

/**
 * A class for storing application state to do with authentication. This is a simple
 * store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 */
class LifecycleStore extends AsyncStore<IState> {
    public constructor() {
        super(dis, INITIAL_STATE);
    }

    protected onDispatch(payload: ActionPayload | DoAfterSyncPreparedPayload<ActionPayload>): void {
        switch (payload.action) {
            case Action.DoAfterSyncPrepared:
                this.updateState({
                    deferredAction: payload.deferred_action,
                });
                break;
            case "cancel_after_sync_prepared":
                this.updateState({
                    deferredAction: null,
                });
                break;
            case "MatrixActions.sync": {
                if (payload.state === SyncState.Syncing && payload.prevState !== SyncState.Syncing) {
                    // We've reconnected to the server: update server version support
                    // This is async but we don't care about the result, so just fire & forget.
                    checkServerVersions();
                }

                if (payload.state !== "PREPARED") {
                    break;
                }
                if (!this.state.deferredAction) break;
                const deferredAction = Object.assign({}, this.state.deferredAction);
                this.updateState({
                    deferredAction: null,
                });
                dis.dispatch(deferredAction);
                break;
            }
            case "on_client_not_viable":
            case Action.OnLoggedOut:
                this.reset();
                break;
        }
    }
}

async function checkServerVersions(): Promise<void> {
    try {
        const client = MatrixClientPeg.get();
        if (!client) return;
        for (const version of SUPPORTED_MATRIX_VERSIONS) {
            // Check if the server supports this spec version. (`isVersionSupported` caches the response, so this loop will
            // only make a single HTTP request).
            // Note that although we do this on a reconnect, we cache the server's versions in memory
            // indefinitely, so it will only ever trigger the toast on the first connection after a fresh
            // restart of the client.
            if (await client.isVersionSupported(version)) {
                // we found a compatible spec version
                return;
            }
        }

        // This is retrospective doc having debated about the exactly what this toast is for, but
        // our guess is that it's a nudge to update, or ask your HS admin to update your Homeserver
        // after a new version of Element has come out, in a way that doesn't lock you out of all
        // your messages.
        const toastKey = "LEGACY_SERVER";
        ToastStore.sharedInstance().addOrReplaceToast({
            key: toastKey,
            title: _t("unsupported_server_title"),
            props: {
                description: _t("unsupported_server_description", {
                    version: MINIMUM_MATRIX_VERSION,
                    brand: SdkConfig.get().brand,
                }),
                primaryLabel: _t("action|ok"),
                onPrimaryClick: () => {
                    ToastStore.sharedInstance().dismissToast(toastKey);
                },
            },
            component: GenericToast,
            priority: 98,
        });
    } catch (e) {
        logger.warn("Failed to check server versions", e);
    }
}

let singletonLifecycleStore: LifecycleStore | null = null;
if (!singletonLifecycleStore) {
    singletonLifecycleStore = new LifecycleStore();
}
export default singletonLifecycleStore!;
