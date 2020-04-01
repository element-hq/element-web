/*
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

import {MatrixClientPeg} from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import Timer from "../utils/Timer";

const TYPING_USER_TIMEOUT = 10000;
const TYPING_SERVER_TIMEOUT = 30000;

/**
 * Tracks typing state for users.
 */
export default class TypingStore {
    constructor() {
        this.reset();
    }

    static sharedInstance(): TypingStore {
        if (global.mxTypingStore === undefined) {
            global.mxTypingStore = new TypingStore();
        }
        return global.mxTypingStore;
    }

    /**
     * Clears all cached typing states. Intended to be called when the
     * MatrixClientPeg client changes.
     */
    reset() {
        this._typingStates = {
            // "roomId": {
            //     isTyping: bool,     // Whether the user is typing or not
            //     userTimer: Timer,   // Local timeout for "user has stopped typing"
            //     serverTimer: Timer, // Maximum timeout for the typing state
            // },
        };
    }

    /**
     * Changes the typing status for the MatrixClientPeg user.
     * @param {string} roomId The room ID to set the typing state in.
     * @param {boolean} isTyping Whether the user is typing or not.
     */
    setSelfTyping(roomId: string, isTyping: boolean): void {
        if (!SettingsStore.getValue('sendTypingNotifications')) return;
        if (SettingsStore.getValue('lowBandwidth')) return;

        let currentTyping = this._typingStates[roomId];
        if ((!isTyping && !currentTyping) || (currentTyping && currentTyping.isTyping === isTyping)) {
            // No change in state, so don't do anything. We'll let the timer run its course.
            return;
        }

        if (!currentTyping) {
            currentTyping = this._typingStates[roomId] = {
                isTyping: isTyping,
                serverTimer: new Timer(TYPING_SERVER_TIMEOUT),
                userTimer: new Timer(TYPING_USER_TIMEOUT),
            };
        }

        currentTyping.isTyping = isTyping;

        if (isTyping) {
            if (!currentTyping.serverTimer.isRunning()) {
                currentTyping.serverTimer.restart().finished().then(() => {
                    const currentTyping = this._typingStates[roomId];
                    if (currentTyping) currentTyping.isTyping = false;

                    // The server will (should) time us out on typing, so we don't
                    // need to advertise a stop of typing.
                });
            } else currentTyping.serverTimer.restart();

            if (!currentTyping.userTimer.isRunning()) {
                currentTyping.userTimer.restart().finished().then(() => {
                    this.setSelfTyping(roomId, false);
                });
            } else currentTyping.userTimer.restart();
        }

        MatrixClientPeg.get().sendTyping(roomId, isTyping, TYPING_SERVER_TIMEOUT);
    }
}
