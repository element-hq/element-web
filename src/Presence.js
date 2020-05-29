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

import {MatrixClientPeg} from "./MatrixClientPeg";
import dis from "./dispatcher/dispatcher";
import Timer from './utils/Timer';

 // Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins
const PRESENCE_STATES = ["online", "offline", "unavailable"];

class Presence {
    constructor() {
        this._activitySignal = null;
        this._unavailableTimer = null;
        this._onAction = this._onAction.bind(this);
        this._dispatcherRef = null;
    }
    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the homeserver.
     */
    async start() {
        this._unavailableTimer = new Timer(UNAVAILABLE_TIME_MS);
        // the user_activity_start action starts the timer
        this._dispatcherRef = dis.register(this._onAction);
        while (this._unavailableTimer) {
            try {
                await this._unavailableTimer.finished();
                this.setState("unavailable");
            } catch (e) { /* aborted, stop got called */ }
        }
    }

    /**
     * Stop tracking user activity
     */
    stop() {
        if (this._dispatcherRef) {
            dis.unregister(this._dispatcherRef);
            this._dispatcherRef = null;
        }
        if (this._unavailableTimer) {
            this._unavailableTimer.abort();
            this._unavailableTimer = null;
        }
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    getState() {
        return this.state;
    }

    _onAction(payload) {
        if (payload.action === 'user_activity') {
            this.setState("online");
            this._unavailableTimer.restart();
        }
    }

    /**
     * Set the presence state.
     * If the state has changed, the homeserver will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    async setState(newState) {
        if (newState === this.state) {
            return;
        }
        if (PRESENCE_STATES.indexOf(newState) === -1) {
            throw new Error("Bad presence state: " + newState);
        }
        const oldState = this.state;
        this.state = newState;

        if (MatrixClientPeg.get().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        try {
            await MatrixClientPeg.get().setPresence(this.state);
            console.info("Presence: %s", newState);
        } catch (err) {
            console.error("Failed to set presence: %s", err);
            this.state = oldState;
        }
    }
}

export default new Presence();
