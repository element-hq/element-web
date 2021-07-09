/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixError } from "matrix-js-sdk/src/http-api";
import { defer, IDeferred } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg } from '../MatrixClientPeg';
import { AddressType, getAddressType } from '../UserAddress';
import GroupStore from '../stores/GroupStore';
import { _t } from "../languageHandler";
import Modal from "../Modal";
import SettingsStore from "../settings/SettingsStore";
import AskInviteAnywayDialog from "../components/views/dialogs/AskInviteAnywayDialog";

export enum InviteState {
    Invited = "invited",
    Error = "error",
}

interface IError {
    errorText: string;
    errcode: string;
}

const UNKNOWN_PROFILE_ERRORS = ['M_NOT_FOUND', 'M_USER_NOT_FOUND', 'M_PROFILE_UNDISCLOSED', 'M_PROFILE_NOT_FOUND'];

export type CompletionStates = Record<string, InviteState>;

/**
 * Invites multiple addresses to a room or group, handling rate limiting from the server
 */
export default class MultiInviter {
    private readonly roomId?: string;
    private readonly groupId?: string;

    private canceled = false;
    private addresses: string[] = [];
    private busy = false;
    private _fatal = false;
    private completionStates: CompletionStates = {}; // State of each address (invited or error)
    private errors: Record<string, IError> = {}; // { address: {errorText, errcode} }
    private deferred: IDeferred<CompletionStates> = null;
    private reason: string = null;

    /**
     * @param {string} targetId The ID of the room or group to invite to
     */
    constructor(targetId: string) {
        if (targetId[0] === '+') {
            this.roomId = null;
            this.groupId = targetId;
        } else {
            this.roomId = targetId;
            this.groupId = null;
        }
    }

    public get fatal() {
        return this._fatal;
    }

    /**
     * Invite users to this room. This may only be called once per
     * instance of the class.
     *
     * @param {array} addresses Array of addresses to invite
     * @param {string} reason Reason for inviting (optional)
     * @returns {Promise} Resolved when all invitations in the queue are complete
     */
    public invite(addresses, reason?: string): Promise<CompletionStates> {
        if (this.addresses.length > 0) {
            throw new Error("Already inviting/invited");
        }
        this.addresses.push(...addresses);
        this.reason = reason;

        for (const addr of this.addresses) {
            if (getAddressType(addr) === null) {
                this.completionStates[addr] = InviteState.Error;
                this.errors[addr] = {
                    errcode: 'M_INVALID',
                    errorText: _t('Unrecognised address'),
                };
            }
        }
        this.deferred = defer<CompletionStates>();
        this.inviteMore(0);

        return this.deferred.promise;
    }

    /**
     * Stops inviting. Causes promises returned by invite() to be rejected.
     */
    public cancel(): void {
        if (!this.busy) return;

        this.canceled = true;
        this.deferred.reject(new Error('canceled'));
    }

    public getCompletionState(addr: string): InviteState {
        return this.completionStates[addr];
    }

    public getErrorText(addr: string): string {
        return this.errors[addr] ? this.errors[addr].errorText : null;
    }

    private async inviteToRoom(roomId: string, addr: string, ignoreProfile = false): Promise<{}> {
        const addrType = getAddressType(addr);

        if (addrType === AddressType.Email) {
            return MatrixClientPeg.get().inviteByEmail(roomId, addr);
        } else if (addrType === AddressType.MatrixUserId) {
            const room = MatrixClientPeg.get().getRoom(roomId);
            if (!room) throw new Error("Room not found");

            const member = room.getMember(addr);
            if (member && ['join', 'invite'].includes(member.membership)) {
                throw new new MatrixError({
                    errcode: "RIOT.ALREADY_IN_ROOM",
                    error: "Member already invited",
                });
            }

            if (!ignoreProfile && SettingsStore.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
                const profile = await MatrixClientPeg.get().getProfileInfo(addr);
                if (!profile) {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error("User has no profile");
                }
            }

            return MatrixClientPeg.get().invite(roomId, addr, undefined, this.reason);
        } else {
            throw new Error('Unsupported address');
        }
    }

    private doInvite(address: string, ignoreProfile = false): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(`Inviting ${address}`);

            let doInvite;
            if (this.groupId !== null) {
                doInvite = GroupStore.inviteUserToGroup(this.groupId, address);
            } else {
                doInvite = this.inviteToRoom(this.roomId, address, ignoreProfile);
            }

            doInvite.then(() => {
                if (this.canceled) {
                    return;
                }

                this.completionStates[address] = InviteState.Invited;
                delete this.errors[address];

                resolve();
            }).catch((err) => {
                if (this.canceled) {
                    return;
                }

                console.error(err);

                let errorText;
                let fatal = false;
                if (err.errcode === 'M_FORBIDDEN') {
                    fatal = true;
                    errorText = _t('You do not have permission to invite people to this room.');
                } else if (err.errcode === "RIOT.ALREADY_IN_ROOM") {
                    errorText = _t("User %(userId)s is already in the room", { userId: address });
                } else if (err.errcode === 'M_LIMIT_EXCEEDED') {
                    // we're being throttled so wait a bit & try again
                    setTimeout(() => {
                        this.doInvite(address, ignoreProfile).then(resolve, reject);
                    }, 5000);
                    return;
                } else if (['M_NOT_FOUND', 'M_USER_NOT_FOUND'].includes(err.errcode)) {
                    errorText = _t("User %(user_id)s does not exist", { user_id: address });
                } else if (err.errcode === 'M_PROFILE_UNDISCLOSED') {
                    errorText = _t("User %(user_id)s may or may not exist", { user_id: address });
                } else if (err.errcode === 'M_PROFILE_NOT_FOUND' && !ignoreProfile) {
                    // Invite without the profile check
                    console.warn(`User ${address} does not have a profile - inviting anyways automatically`);
                    this.doInvite(address, true).then(resolve, reject);
                } else if (err.errcode === "M_BAD_STATE") {
                    errorText = _t("The user must be unbanned before they can be invited.");
                } else if (err.errcode === "M_UNSUPPORTED_ROOM_VERSION") {
                    errorText = _t("The user's homeserver does not support the version of the room.");
                } else {
                    errorText = _t('Unknown server error');
                }

                this.completionStates[address] = InviteState.Error;
                this.errors[address] = { errorText, errcode: err.errcode };

                this.busy = !fatal;
                this._fatal = fatal;

                if (fatal) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private inviteMore(nextIndex: number, ignoreProfile = false): void {
        if (this.canceled) {
            return;
        }

        if (nextIndex === this.addresses.length) {
            this.busy = false;
            if (Object.keys(this.errors).length > 0 && !this.groupId) {
                // There were problems inviting some people - see if we can invite them
                // without caring if they exist or not.
                const unknownProfileUsers = Object.keys(this.errors)
                    .filter(a => UNKNOWN_PROFILE_ERRORS.includes(this.errors[a].errcode));

                if (unknownProfileUsers.length > 0) {
                    const inviteUnknowns = () => {
                        const promises = unknownProfileUsers.map(u => this.doInvite(u, true));
                        Promise.all(promises).then(() => this.deferred.resolve(this.completionStates));
                    };

                    if (!SettingsStore.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
                        inviteUnknowns();
                        return;
                    }

                    console.log("Showing failed to invite dialog...");
                    Modal.createTrackedDialog('Failed to invite', '', AskInviteAnywayDialog, {
                        unknownProfileUsers: unknownProfileUsers.map(u => ({
                            userId: u,
                            errorText: this.errors[u].errorText,
                        })),
                        onInviteAnyways: () => inviteUnknowns(),
                        onGiveUp: () => {
                            // Fake all the completion states because we already warned the user
                            for (const addr of unknownProfileUsers) {
                                this.completionStates[addr] = InviteState.Invited;
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

        const addr = this.addresses[nextIndex];

        // don't try to invite it if it's an invalid address
        // (it will already be marked as an error though,
        // so no need to do so again)
        if (getAddressType(addr) === null) {
            this.inviteMore(nextIndex + 1);
            return;
        }

        // don't re-invite (there's no way in the UI to do this, but
        // for sanity's sake)
        if (this.completionStates[addr] === InviteState.Invited) {
            this.inviteMore(nextIndex + 1);
            return;
        }

        this.doInvite(addr, ignoreProfile).then(() => {
            this.inviteMore(nextIndex + 1, ignoreProfile);
        }).catch(() => this.deferred.resolve(this.completionStates));
    }
}
