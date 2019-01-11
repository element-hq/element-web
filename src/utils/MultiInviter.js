/*
Copyright 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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

import React from "react";
import MatrixClientPeg from '../MatrixClientPeg';
import {getAddressType} from '../UserAddress';
import GroupStore from '../stores/GroupStore';
import Promise from 'bluebird';
import {_t} from "../languageHandler";
import sdk from "../index";
import Modal from "../Modal";
import SettingsStore from "../settings/SettingsStore";

/**
 * Invites multiple addresses to a room or group, handling rate limiting from the server
 */
export default class MultiInviter {
    /**
     * @param {string} targetId The ID of the room or group to invite to
     */
    constructor(targetId) {
        if (targetId[0] === '+') {
            this.roomId = null;
            this.groupId = targetId;
        } else {
            this.roomId = targetId;
            this.groupId = null;
        }

        this.canceled = false;
        this.addrs = [];
        this.busy = false;
        this.completionStates = {}; // State of each address (invited or error)
        this.errors = {}; // { address: {errorText, errcode} }
        this.deferred = null;
    }

    /**
     * Invite users to this room. This may only be called once per
     * instance of the class.
     *
     * @param {array} addrs Array of addresses to invite
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
                this.errors[addr] = {
                    errcode: 'M_INVALID',
                    errorText: _t('Unrecognised address'),
                };
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
        return this.errors[addr] ? this.errors[addr].errorText : null;
    }

    async _inviteToRoom(roomId, addr, ignoreProfile) {
        const addrType = getAddressType(addr);

        if (addrType === 'email') {
            return MatrixClientPeg.get().inviteByEmail(roomId, addr);
        } else if (addrType === 'mx-user-id') {
            if (!ignoreProfile && !SettingsStore.getValue("alwaysRetryInvites", this.roomId)) {
                const profile = await MatrixClientPeg.get().getProfileInfo(addr);
                if (!profile) {
                    return Promise.reject({
                        errcode: "M_NOT_FOUND",
                        error: "User does not have a profile or does not exist.",
                    });
                }
            }

            return MatrixClientPeg.get().invite(roomId, addr);
        } else {
            throw new Error('Unsupported address');
        }
    }

    _doInvite(address, ignoreProfile) {
        return new Promise((resolve, reject) => {
            let doInvite;
            if (this.groupId !== null) {
                doInvite = GroupStore.inviteUserToGroup(this.groupId, address);
            } else {
                doInvite = this._inviteToRoom(this.roomId, address, ignoreProfile);
            }

            doInvite.then(() => {
                if (this._canceled) {
                    return;
                }

                this.completionStates[address] = 'invited';
                delete this.errors[address];

                resolve();
            }).catch((err) => {
                if (this._canceled) {
                    return;
                }

                let errorText;
                let fatal = false;
                if (err.errcode === 'M_FORBIDDEN') {
                    fatal = true;
                    errorText = _t('You do not have permission to invite people to this room.');
                } else if (err.errcode === 'M_LIMIT_EXCEEDED') {
                    // we're being throttled so wait a bit & try again
                    setTimeout(() => {
                        this._doInvite(address, ignoreProfile).then(resolve, reject);
                    }, 5000);
                    return;
                } else if (['M_NOT_FOUND', 'M_USER_NOT_FOUND'].includes(err.errcode)) {
                    errorText = _t("User %(user_id)s does not exist", {user_id: address});
                } else if (err.errcode === 'M_PROFILE_UNKNOWN') {
                    errorText = _t("User %(user_id)s may or may not exist", {user_id: address});
                } else if (err.errcode === 'M_PROFILE_NOT_FOUND' && !ignoreProfile) {
                    // Invite without the profile check
                    console.warn(`User ${address} does not have a profile - trying invite again`);
                    this._doInvite(address, true).then(resolve, reject);
                } else {
                    errorText = _t('Unknown server error');
                }

                this.completionStates[address] = 'error';
                this.errors[address] = {errorText, errcode: err.errcode};

                this.busy = !fatal;
                this.fatal = fatal;

                if (fatal) {
                    reject();
                } else {
                    resolve();
                }
            });
        });
    }

    _inviteMore(nextIndex, ignoreProfile) {
        if (this._canceled) {
            return;
        }

        if (nextIndex === this.addrs.length) {
            this.busy = false;
            if (Object.keys(this.errors).length > 0 && !this.groupId) {
                // There were problems inviting some people - see if we can invite them
                // without caring if they exist or not.
                const reinviteErrors = ['M_NOT_FOUND', 'M_USER_NOT_FOUND', 'M_PROFILE_UNKNOWN', 'M_PROFILE_NOT_FOUND'];
                const reinvitableUsers = Object.keys(this.errors).filter(a => reinviteErrors.includes(this.errors[a].errcode));

                if (reinvitableUsers.length > 0) {
                    const retryInvites = () => {
                        const promises = reinvitableUsers.map(u => this._doInvite(u, true));
                        Promise.all(promises).then(() => this.deferred.resolve(this.completionStates));
                    };

                    if (SettingsStore.getValue("alwaysRetryInvites", this.roomId)) {
                        retryInvites();
                        return;
                    }

                    const RetryInvitesDialog = sdk.getComponent("dialogs.RetryInvitesDialog");
                    console.log("Showing failed to invite dialog...");
                    Modal.createTrackedDialog('Failed to invite the following users to the room', '', RetryInvitesDialog, {
                        failedInvites: this.errors,
                        onTryAgain: () => retryInvites(),
                        onGiveUp: () => {
                            // Fake all the completion states because we already warned the user
                            for (const addr of Object.keys(this.completionStates)) {
                                this.completionStates[addr] = 'invited';
                            }
                            this.deferred.resolve(this.completionStates);
                        },
                    });
                    return;
                }
            }
            this.deferred.resolve(this.completionStates);
            return;
        }

        const addr = this.addrs[nextIndex];
        console.log(`Inviting ${addr}`);

        // don't try to invite it if it's an invalid address
        // (it will already be marked as an error though,
        // so no need to do so again)
        if (getAddressType(addr) === null) {
            this._inviteMore(nextIndex + 1);
            return;
        }

        // don't re-invite (there's no way in the UI to do this, but
        // for sanity's sake)
        if (this.completionStates[addr] === 'invited') {
            this._inviteMore(nextIndex + 1);
            return;
        }

        this._doInvite(addr, ignoreProfile).then(() => {
            this._inviteMore(nextIndex + 1, ignoreProfile);
        }).catch(() => this.deferred.resolve(this.completionStates));
    }
}
