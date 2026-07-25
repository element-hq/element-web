/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Call } from "./models/Call";
import SettingsStore from "./settings/SettingsStore";
import { type CallStore, CallStoreEvent } from "./stores/CallStore";
import { setUserOnCall } from "./utils/userStatus";
import { logger } from "matrix-js-sdk/src/logger";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Listener that updates the user's on-a-call (m.call) user profile status according to
 * whether the user is on a call. Nothing should be calling any methods on it apart
 * from start / stop.
 */
export class CallStatusListener {
    private callStore: CallStore | undefined;
    private matrixClient: MatrixClient | undefined;

    public static sharedInstance(): CallStatusListener {
        if (!window.mxCallStatusListener) window.mxCallStatusListener = new CallStatusListener();
        return window.mxCallStatusListener;
    }

    public start(callStore: CallStore, matrixClient: MatrixClient): void {
        this.callStore = callStore;
        this.matrixClient = matrixClient;

        this.callStore.on(CallStoreEvent.ConnectedCalls, this.onConnectedCallsChanged);
    }

    public stop(): void {
        this.callStore?.off(CallStoreEvent.ConnectedCalls, this.onConnectedCallsChanged);

        this.callStore = undefined;
        this.matrixClient = undefined;
    }

    private onConnectedCallsChanged = (newValue: Set<Call>, oldValue: Set<Call>): void => {
        const wasInCall = oldValue.size > 0;
        const nowInCall = newValue.size > 0;

        if (wasInCall !== nowInCall && SettingsStore.getValue("feature_user_status") && this.matrixClient) {
            setUserOnCall(this.matrixClient, nowInCall).catch((err) =>
                logger.warn("Failed to update m.call profile field", err),
            );
        }
    };
}
