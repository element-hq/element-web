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

// Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins

class Presence {
    private unavailableTimer?: Timer;
    private dispatcherRef?: string;
    private state?: SetPresence;

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the homeserver.
     */
    public async start(): Promise<void> {
        this.unavailableTimer = new Timer(UNAVAILABLE_TIME_MS);
        // the user_activity_start action starts the timer
        this.dispatcherRef = dis.register(this.onAction);
        while (this.unavailableTimer) {
            try {
                await this.unavailableTimer.finished();
                this.setState(SetPresence.Unavailable);
            } catch {
                /* aborted, stop got called */
            }
        }
    }

    /**
     * Stop tracking user activity
     */
    public stop(): void {
        dis.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;
        this.unavailableTimer?.abort();
        this.unavailableTimer = undefined;
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    public getState(): SetPresence | null {
        return this.state ?? null;
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "user_activity") {
            this.setState(SetPresence.Online);
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
        this.state = newState;

        if (MatrixClientPeg.safeGet().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        try {
            await MatrixClientPeg.safeGet().setSyncPresence(this.state);
            logger.debug("Presence:", newState);
        } catch (err) {
            logger.error("Failed to set presence:", err);
            this.state = oldState;
        }
    }
}

export default new Presence();
