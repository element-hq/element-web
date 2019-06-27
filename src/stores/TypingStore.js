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

import MatrixClientPeg from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";

export const TYPING_SERVER_TIMEOUT = 30000;

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
        this._typingStates = {}; // roomId => { isTyping, expireMs }
    }

    /**
     * Changes the typing status for the MatrixClientPeg user.
     * @param {string} roomId The room ID to set the typing state in.
     * @param {boolean} isTyping Whether the user is typing or not.
     */
    setSelfTyping(roomId: string, isTyping: boolean): void {
        if (!SettingsStore.getValue('sendTypingNotifications')) return;
        if (SettingsStore.getValue('lowBandwidth')) return;

        const currentTyping = this._typingStates[roomId];
        if ((!isTyping && !currentTyping) || (currentTyping && currentTyping.isTyping === isTyping)) {
            // No change in state, so don't do anything. We'll let the timer run its course.
            return;
        }

        const now = new Date().getTime();
        this._typingStates[roomId] = {
            isTyping: isTyping,
            expireMs: now + TYPING_SERVER_TIMEOUT,
        };

        if (isTyping) {
            setTimeout(() => {
                const currentTyping = this._typingStates[roomId];
                const now = new Date().getTime();

                if (currentTyping && currentTyping.expireMs >= now) {
                    currentTyping.isTyping = false;
                }
            }, TYPING_SERVER_TIMEOUT);
        }

        MatrixClientPeg.get().sendTyping(roomId, isTyping, TYPING_SERVER_TIMEOUT);
    }
}
