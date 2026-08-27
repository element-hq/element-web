/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { SetPresence } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "./MatrixClientPeg";
import dis from "./dispatcher/dispatcher";
import Timer from "./utils/Timer";
import { type ActionPayload } from "./dispatcher/payloads";
import { Action } from "./dispatcher/actions.ts";

// Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins

class Presence {
    private unavailableTimer?: Timer;
    private dispatcherRef?: string;
    private state?: SetPresence;
    private stopSignal?: PromiseWithResolvers<void>;
    private stateChangeId = 0;

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the homeserver.
     */
    public async start(): Promise<void> {
        if (this.unavailableTimer) return;

        const timer = new Timer(UNAVAILABLE_TIME_MS);
        const stopSignal = Promise.withResolvers<void>();
        this.unavailableTimer = timer;
        this.stopSignal = stopSignal;
        // Start the inactivity window with the initial online state so idle tabs become unavailable.
        timer.start();
        this.dispatcherRef = dis.register(this.onAction);
        void this.setState(SetPresence.Online);
        while (this.unavailableTimer === timer) {
            try {
                await Promise.race([timer.finished(), stopSignal.promise]);
                if (this.unavailableTimer !== timer) return;
                await this.setState(SetPresence.Unavailable);
            } catch {
                /* aborted, stop got called */
            }
        }
    }

    /**
     * Stop tracking user activity
     */
    public stop(): void {
        this.stateChangeId++;
        this.stopSignal?.resolve();
        this.stopSignal = undefined;
        dis.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;
        this.unavailableTimer?.abort();
        this.unavailableTimer = undefined;
        this.state = undefined;
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    public getState(): SetPresence | null {
        return this.state ?? null;
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.UserActivity) {
            void this.setState(SetPresence.Online);
            this.unavailableTimer?.restart();
        }
    };

    /**
     * Set the presence state.
     * If the state has changed, the homeserver will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    private async setState(newState: SetPresence): Promise<void> {
        if (newState === this.state) {
            return;
        }

        const oldState = this.state;
        const stateChangeId = ++this.stateChangeId;
        this.state = newState;

        if (MatrixClientPeg.safeGet().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        try {
            await MatrixClientPeg.safeGet().setSyncPresence(this.state);
            logger.debug("Presence:", newState);
        } catch (err) {
            logger.error("Failed to set presence:", err);
            // Ignore failures from transitions superseded by a newer lifecycle or state change.
            if (stateChangeId === this.stateChangeId) {
                this.state = oldState;
            }
        }
    }
}

export default new Presence();
