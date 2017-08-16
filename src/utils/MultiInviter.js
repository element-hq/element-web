/*
Copyright 2016 OpenMarket Ltd

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

import {getAddressType} from '../UserAddress';
import {inviteToRoom} from '../Invite';
import Promise from 'bluebird';

/**
 * Invites multiple addresses to a room, handling rate limiting from the server
 */
export default class MultiInviter {
    constructor(roomId) {
        this.roomId = roomId;

        this.canceled = false;
        this.addrs = [];
        this.busy = false;
        this.completionStates = {}; // State of each address (invited or error)
        this.errorTexts = {}; // Textual error per address
        this.deferred = null;
    }

    /**
     * Invite users to this room. This may only be called once per
     * instance of the class.
     *
     * @param {array} addresses Array of addresses to invite
     * @returns {Promise} Resolved when all invitations in the queue are complete
     */
    invite(addrs) {
        if (this.addrs.length > 0) {
            throw new Error("Already inviting/invited");
        }
        this.addrs.push(...addrs);

        for (const addr of this.addrs) {
            if (getAddressType(addr) === null) {
                this.completionStates[addr] = 'error';
                this.errorTexts[addr] = 'Unrecognised address';
            }
        }
        this.deferred = Promise.defer();
        this._inviteMore(0);

        return this.deferred.promise;
    }

    /**
     * Stops inviting. Causes promises returned by invite() to be rejected.
     */
    cancel() {
        if (!this.busy) return;

        this._canceled = true;
        this.deferred.reject(new Error('canceled'));
    }

    getCompletionState(addr) {
        return this.completionStates[addr];
    }

    getErrorText(addr) {
        return this.errorTexts[addr];
    }

    _inviteMore(nextIndex) {
        if (this._canceled) {
            return;
        }

        if (nextIndex == this.addrs.length) {
            this.busy = false;
            this.deferred.resolve(this.completionStates);
            return;
        }

        const addr = this.addrs[nextIndex];

        // don't try to invite it if it's an invalid address
        // (it will already be marked as an error though,
        // so no need to do so again)
        if (getAddressType(addr) === null) {
            this._inviteMore(nextIndex + 1);
            return;
        }

        // don't re-invite (there's no way in the UI to do this, but
        // for sanity's sake)
        if (this.completionStates[addr] == 'invited') {
            this._inviteMore(nextIndex + 1);
            return;
        }

        inviteToRoom(this.roomId, addr).then(() => {
            if (this._canceled) { return; }

            this.completionStates[addr] = 'invited';

            this._inviteMore(nextIndex + 1);
        }, (err) => {
            if (this._canceled) { return; }

            let errorText;
            let fatal = false;
            if (err.errcode == 'M_FORBIDDEN') {
                fatal = true;
                errorText = 'You do not have permission to invite people to this room.';
            } else if (err.errcode == 'M_LIMIT_EXCEEDED') {
                // we're being throttled so wait a bit & try again
                setTimeout(() => {
                    this._inviteMore(nextIndex);
                }, 5000);
                return;
            } else {
                errorText = 'Unknown server error';
            }
            this.completionStates[addr] = 'error';
            this.errorTexts[addr] = errorText;
            this.busy = !fatal;

            if (!fatal) {
                this._inviteMore(nextIndex + 1);
            }
        });
    }
}
