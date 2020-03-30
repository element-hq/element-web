/*
Copyright 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import {MatrixClientPeg} from './MatrixClientPeg';
import MultiInviter from './utils/MultiInviter';
import Modal from './Modal';
import * as sdk from './';
import { _t } from './languageHandler';
import {KIND_DM, KIND_INVITE} from "./components/views/dialogs/InviteDialog";

/**
 * Invites multiple addresses to a room
 * Simpler interface to utils/MultiInviter but with
 * no option to cancel.
 *
 * @param {string} roomId The ID of the room to invite to
 * @param {string[]} addrs Array of strings of addresses to invite. May be matrix IDs or 3pids.
 * @returns {Promise} Promise
 */
export function inviteMultipleToRoom(roomId, addrs) {
    const inviter = new MultiInviter(roomId);
    return inviter.invite(addrs).then(states => Promise.resolve({states, inviter}));
}

export function showStartChatInviteDialog() {
    // This dialog handles the room creation internally - we don't need to worry about it.
    const InviteDialog = sdk.getComponent("dialogs.InviteDialog");
    Modal.createTrackedDialog(
        'Start DM', '', InviteDialog, {kind: KIND_DM},
        /*className=*/null, /*isPriority=*/false, /*isStatic=*/true,
    );
}

export function showRoomInviteDialog(roomId) {
    // This dialog handles the room creation internally - we don't need to worry about it.
    const InviteDialog = sdk.getComponent("dialogs.InviteDialog");
    Modal.createTrackedDialog(
        'Invite Users', '', InviteDialog, {kind: KIND_INVITE, roomId},
        /*className=*/null, /*isPriority=*/false, /*isStatic=*/true,
    );
}

/**
 * Checks if the given MatrixEvent is a valid 3rd party user invite.
 * @param {MatrixEvent} event The event to check
 * @returns {boolean} True if valid, false otherwise
 */
export function isValid3pidInvite(event) {
    if (!event || event.getType() !== "m.room.third_party_invite") return false;

    // any events without these keys are not valid 3pid invites, so we ignore them
    const requiredKeys = ['key_validity_url', 'public_key', 'display_name'];
    for (let i = 0; i < requiredKeys.length; ++i) {
        if (!event.getContent()[requiredKeys[i]]) return false;
    }

    // Valid enough by our standards
    return true;
}

export function inviteUsersToRoom(roomId, userIds) {
    return inviteMultipleToRoom(roomId, userIds).then((result) => {
        const room = MatrixClientPeg.get().getRoom(roomId);
        return _showAnyInviteErrors(result.states, room, result.inviter);
    }).catch((err) => {
        console.error(err.stack);
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
            title: _t("Failed to invite"),
            description: ((err && err.message) ? err.message : _t("Operation failed")),
        });
    });
}

function _showAnyInviteErrors(addrs, room, inviter) {
    // Show user any errors
    const failedUsers = Object.keys(addrs).filter(a => addrs[a] === 'error');
    if (failedUsers.length === 1 && inviter.fatal) {
        // Just get the first message because there was a fatal problem on the first
        // user. This usually means that no other users were attempted, making it
        // pointless for us to list who failed exactly.
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite users to the room', '', ErrorDialog, {
            title: _t("Failed to invite users to the room:", {roomName: room.name}),
            description: inviter.getErrorText(failedUsers[0]),
        });
    } else {
        const errorList = [];
        for (const addr of failedUsers) {
            if (addrs[addr] === "error") {
                const reason = inviter.getErrorText(addr);
                errorList.push(addr + ": " + reason);
            }
        }

        if (errorList.length > 0) {
            // React 16 doesn't let us use `errorList.join(<br />)` anymore, so this is our solution
            const description = <div>{errorList.map(e => <div key={e}>{e}</div>)}</div>;

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to invite the following users to the room', '', ErrorDialog, {
                title: _t("Failed to invite the following users to the %(roomName)s room:", {roomName: room.name}),
                description,
            });
        }
    }

    return addrs;
}
