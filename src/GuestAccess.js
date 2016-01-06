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
const IS_GUEST_KEY = "matrix-is-guest";

class GuestAccess {

    constructor(localStorage) {
        this.localStorage = localStorage;
        try {
            this._isGuest = localStorage.getItem(IS_GUEST_KEY) === "true";
        }
        catch (e) {} // don't care
    }

    setPeekedRoom(roomId) {
        // we purposefully do not persist this to local storage as peeking is
        // entirely transient.
        this._peekedRoomId = roomId;
    }

    getPeekedRoom() {
        return this._peekedRoomId;
    }

    isGuest() {
        return this._isGuest;
    }

    markAsGuest(isGuest) {
        try {
            this.localStorage.setItem(IS_GUEST_KEY, JSON.stringify(isGuest));
        } catch (e) {} // ignore. If they don't do LS, they'll just get a new account.
        this._isGuest = isGuest;
        this._peekedRoomId = null;
    }
}

module.exports = GuestAccess;
