/*
Copyright 2015 OpenMarket Ltd

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
"use strict";
var MatrixClientPeg = require("./MatrixClientPeg");

 // Time in ms after that a user is considered as unavailable/away
var UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins
var PRESENCE_STATES = ["online", "offline", "unavailable"];

// The current presence state
var state, timer;

module.exports = {

    /**
     * Start listening the user activity to evaluate his presence state.
     * Any state change will be sent to the Home Server.
     */
    start: function() {
        var self = this;
        this.running = true;
        if (undefined === state) {
            // The user is online if they move the mouse or press a key
            document.onmousemove = function() { self._resetTimer(); };
            document.onkeypress = function() { self._resetTimer(); };
            this._resetTimer();
        }
    },

    /**
     * Stop tracking user activity
     */
    stop: function() {
        this.running = false;
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
        state = undefined;
    },

    /**
     * Get the current presence state.
     * @returns {string} the presence state (see PRESENCE enum)
     */
    getState: function() {
        return state;
    },

    /**
     * Set the presence state.
     * If the state has changed, the Home Server will be notified.
     * @param {string} newState the new presence state (see PRESENCE enum)
     */
    setState: function(newState) {
        if (newState === state) {
            return;
        }
        if (PRESENCE_STATES.indexOf(newState) === -1) {
            throw new Error("Bad presence state: " + newState);
        }
        if (!this.running) {
            return;
        }
        state = newState;
        MatrixClientPeg.get().setPresence(state).done(function() {
            console.log("Presence: %s", newState);
        }, function(err) {
            console.error("Failed to set presence: %s", err);
        });
    },

    /**
     * Callback called when the user made no action on the page for UNAVAILABLE_TIME ms.
     * @private
     */
    _onUnavailableTimerFire: function() {
        this.setState("unavailable");
    },

    /**
     * Callback called when the user made an action on the page
     * @private
     */
    _resetTimer: function() {
        var self = this;
        this.setState("online");
        // Re-arm the timer
        clearTimeout(timer);
        timer = setTimeout(function() {
            self._onUnavailableTimerFire();
        }, UNAVAILABLE_TIME_MS);
    } 
};