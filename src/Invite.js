/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import MultiInviter from './utils/MultiInviter';
import Modal from './Modal';
import { getAddressType } from './UserAddress';
import createRoom from './createRoom';
import sdk from './';
import { _t } from './languageHandler';

export function inviteToRoom(roomId, addr) {
    const addrType = getAddressType(addr);

    if (addrType == 'email') {
        return MatrixClientPeg.get().inviteByEmail(roomId, addr);
    } else if (addrType == 'mx') {
        return MatrixClientPeg.get().invite(roomId, addr);
    } else {
        throw new Error('Unsupported address');
    }
}

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
    return inviter.invite(addrs);
}

export function showStartChatInviteDialog() {
    const UserPickerDialog = sdk.getComponent("dialogs.UserPickerDialog");
    Modal.createTrackedDialog('Start a chat', '', UserPickerDialog, {
        title: _t('Start a chat'),
        description: _t("Who would you like to communicate with?"),
        placeholder: _t("Email, name or matrix ID"),
        button: _t("Start Chat"),
        onFinished: _onStartChatFinished,
    });
}

export function showRoomInviteDialog(roomId) {
    const UserPickerDialog = sdk.getComponent("dialogs.UserPickerDialog");
    Modal.createTrackedDialog('Chat Invite', '', UserPickerDialog, {
        title: _t('Invite new room members'),
        description: _t('Who would you like to add to this room?'),
        button: _t('Send Invites'),
        placeholder: _t("Email, name or matrix ID"),
        onFinished: (shouldInvite, addrs) => {
            _onRoomInviteFinished(roomId, shouldInvite, addrs);
        },
    });
}

function _onStartChatFinished(shouldInvite, addrs) {
    if (!shouldInvite) return;

    const addrTexts = addrs.map((addr) => addr.address);

    if (_isDmChat(addrTexts)) {
        // Start a new DM chat
        createRoom({dmUserId: addrTexts[0]}).catch((err) => {
            console.error(err.stack);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
                title: _t("Failed to invite user"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    } else {
        // Start multi user chat
        let room;
        createRoom().then((roomId) => {
            room = MatrixClientPeg.get().getRoom(roomId);
            return inviteMultipleToRoom(roomId, addrTexts);
        }).then((addrs) => {
            return _showAnyInviteErrors(addrs, room);
        }).catch((err) => {
            console.error(err.stack);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
                title: _t("Failed to invite"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    }
}

function _onRoomInviteFinished(roomId, shouldInvite, addrs) {
    if (!shouldInvite) return;

    const addrTexts = addrs.map((addr) => addr.address);

    // Invite new users to a room
    inviteMultipleToRoom(roomId, addrTexts).then((addrs) => {
        const room = MatrixClientPeg.get().getRoom(roomId);
        return _showAnyInviteErrors(addrs, room);
    }).catch((err) => {
        console.error(err.stack);
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
            title: _t("Failed to invite"),
            description: ((err && err.message) ? err.message : _t("Operation failed")),
        });
    });
}

function _isDmChat(addrTexts) {
    if (addrTexts.length === 1 && getAddressType(addrTexts[0])) {
        return true;
    } else {
        return false;
    }
}

function _showAnyInviteErrors(addrs, room) {
    // Show user any errors
    const errorList = [];
    for (const addr of Object.keys(addrs)) {
        if (addrs[addr] === "error") {
            errorList.push(addr);
        }
    }

    if (errorList.length > 0) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite the following users to the room', '', ErrorDialog, {
            title: _t("Failed to invite the following users to the %(roomName)s room:", {roomName: room.name}),
            description: errorList.join(", "),
        });
    }
    return addrs;
}

