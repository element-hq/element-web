/*
Copyright 2015, 2016 OpenMarket Ltd

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

var MatrixClientPeg = require("./MatrixClientPeg");
var dis = require("./dispatcher");

 // Time in ms after that a user is considered as unavailable/away
var UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins
var PRESENCE_STATES = ["online", "offline", "unavailable"];

class Presence {

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the Home Server.
     */
    start() {
        this.running = true;
        if (undefined === this.state) {
            this._resetTimer();
            this.dispatcherRef = dis.register(this._onUserActivity.bind(this));
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
     * Set the presence state.
     * If the state has changed, the Home Server will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    setState(newState) {
        if (newState === this.state) {
            return;
        }
        if (PRESENCE_STATES.indexOf(newState) === -1) {
            throw new Error("Bad presence state: " + newState);
        }
        if (!this.running) {
            return;
        }
        var old_state = this.state;
        this.state = newState;
        var self = this;
        MatrixClientPeg.get().setPresence(this.state).done(function() {
            console.log("Presence: %s", newState);
        }, function(err) {
            console.error("Failed to set presence: %s", err);
            self.state = old_state;
        });
    }

    /**
     * Callback called when the user made no action on the page for UNAVAILABLE_TIME ms.
     * @private
     */
    _onUnavailableTimerFire() {
        this.setState("unavailable");
    }

    _onUserActivity() {
        this._resetTimer();
    }

    /**
     * Callback called when the user made an action on the page
     * @private
     */
    _resetTimer() {
        var self = this;
        this.setState("online");
        // Re-arm the timer
        clearTimeout(this.timer);
        this.timer = setTimeout(function() {
            self._onUnavailableTimerFire();
        }, UNAVAILABLE_TIME_MS);
    } 
}

module.exports = new Presence();
