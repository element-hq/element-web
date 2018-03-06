/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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

const MatrixClientPeg = require("./MatrixClientPeg");
const dis = require("./dispatcher");

 // Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins
const PRESENCE_STATES = ["online", "offline", "unavailable"];

class Presence {

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the Home Server.
     */
    start() {
        this.running = true;
        if (undefined === this.state) {
            this._resetTimer();
            this.dispatcherRef = dis.register(this._onAction.bind(this));
        }
    }

    /**
     * Stop tracking user activity
     */
    stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
            dis.unregister(this.dispatcherRef);
        }
        this.state = undefined;
    }

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    getState() {
        return this.state;
    }

    /**
     * Get the current status message.
     * @returns {String} the status message, may be null
     */
    getStatusMessage() {
        return this.statusMessage;
    }

    /**
     * Set the presence state.
     * If the state has changed, the Home Server will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     * @param {String} statusMessage an optional status message for the presence
     * @param {boolean} maintain true to have this status maintained by this tracker
     */
    setState(newState, statusMessage=null, maintain=false) {
        if (this.maintain) {
            // Don't update presence if we're maintaining a particular status
            return;
        }
        if (newState === this.state && statusMessage === this.statusMessage) {
            return;
        }
        if (PRESENCE_STATES.indexOf(newState) === -1) {
            throw new Error("Bad presence state: " + newState);
        }
        if (!this.running) {
            return;
        }
        const old_state = this.state;
        const old_message = this.statusMessage;
        this.state = newState;
        this.statusMessage = statusMessage;
        this.maintain = maintain;

        if (MatrixClientPeg.get().isGuest()) {
            return; // don't try to set presence when a guest; it won't work.
        }

        const updateContent = {
            presence: this.state,
            status_msg: this.statusMessage ? this.statusMessage : '',
        };

        const self = this;
        MatrixClientPeg.get().setPresence(updateContent).done(function() {
            console.log("Presence: %s", newState);

            // We have to dispatch because the js-sdk is unreliable at telling us about our own presence
            dis.dispatch({action: "self_presence_updated", statusInfo: updateContent});
        }, function(err) {
            console.error("Failed to set presence: %s", err);
            self.state = old_state;
            self.statusMessage = old_message;
        });
    }

    stopMaintainingStatus() {
        this.maintain = false;
    }

    /**
     * Callback called when the user made no action on the page for UNAVAILABLE_TIME ms.
     * @private
     */
    _onUnavailableTimerFire() {
        this.setState("unavailable");
    }

    _onAction(payload) {
        if (payload.action === "user_activity") {
            this._resetTimer();
        }
    }

    /**
     * Callback called when the user made an action on the page
     * @private
     */
    _resetTimer() {
        const self = this;
        this.setState("online");
        // Re-arm the timer
        clearTimeout(this.timer);
        this.timer = setTimeout(function() {
            self._onUnavailableTimerFire();
        }, UNAVAILABLE_TIME_MS);
    }
}

module.exports = new Presence();
