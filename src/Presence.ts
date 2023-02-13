/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "./MatrixClientPeg";
import dis from "./dispatcher/dispatcher";
import Timer from "./utils/Timer";
import { ActionPayload } from "./dispatcher/payloads";

// Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins

enum State {
    Online = "online",
    Offline = "offline",
    Unavailable = "unavailable",
}

class Presence {
    private unavailableTimer: Timer | null = null;
    private dispatcherRef: string | null = null;
    private state: State | null = null;

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
                this.setState(State.Unavailable);
            } catch (e) {
                /* aborted, stop got called */
            }
        }
    }

    /**
     * Stop tracking user activity
     */
    public stop(): void {
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
            this.dispatcherRef = null;
        }
        if (this.unavailableTimer) {
            this.unavailableTimer.abort();
            this.unavailableTimer = null;
        }
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    public getState(): State | null {
        return this.state;
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "user_activity") {
            this.setState(State.Online);
            this.unavailableTimer?.restart();
        }
    };

    /**
     * Set the presence state.
     * If the state has changed, the homeserver will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    private async setState(newState: State): Promise<void> {
        if (newState === this.state) {
            return;
        }

        const oldState = this.state;
        this.state = newState;

        if (MatrixClientPeg.get().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        try {
            await MatrixClientPeg.get().setPresence({ presence: this.state });
            logger.info("Presence:", newState);
        } catch (err) {
            logger.error("Failed to set presence:", err);
            this.state = oldState;
        }
    }
}

export default new Presence();
