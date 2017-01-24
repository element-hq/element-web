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

var MatrixClientPeg = require('./MatrixClientPeg');
var Modal = require('./Modal');
var sdk = require('./index');
var dis = require("./dispatcher");
var Rooms = require("./Rooms");

var q = require('q');

/**
 * Create a new room, and switch to it.
 *
 * Returns a promise which resolves to the room id, or null if the
 * action was aborted or failed.
 *
 * @param {object=} opts parameters for creating the room
 * @param {string=} opts.dmUserId If specified, make this a DM room for this user and invite them
 * @param {object=} opts.createOpts set of options to pass to createRoom call.
 */
function createRoom(opts) {
    opts = opts || {};

    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
    const NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
    const Loader = sdk.getComponent("elements.Spinner");

    const client = MatrixClientPeg.get();
    if (client.isGuest()) {
        setTimeout(()=>{
            Modal.createDialog(NeedToRegisterDialog, {
                title: "Please Register",
                description: "Guest users can't create new rooms. Please register to create room and start a chat."
            });
        }, 0);
        return q(null);
    }

    const defaultPreset = opts.dmUserId ? 'trusted_private_chat' : 'private_chat';

    // set some defaults for the creation
    const createOpts = opts.createOpts || {};
    createOpts.preset = createOpts.preset || defaultPreset;
    createOpts.visibility = createOpts.visibility || 'private';
    if (opts.dmUserId && createOpts.invite === undefined) {
        createOpts.invite = [opts.dmUserId];
    }
    if (opts.dmUserId && createOpts.is_direct === undefined) {
        createOpts.is_direct = true;
    }

    // Allow guests by default since the room is private and they'd
    // need an invite. This means clicking on a 3pid invite email can
    // actually drop you right in to a chat.
    createOpts.initial_state = createOpts.initial_state || [
        {
            content: {
                guest_access: 'can_join'
            },
            type: 'm.room.guest_access',
            state_key: '',
        }
    ];

    let modal;
    setTimeout(()=>{
        modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');
    }, 0);

    let roomId;
    return client.createRoom(createOpts).finally(function() {
        if (modal) modal.close();
    }).then(function(res) {
        roomId = res.room_id;
        if (opts.dmUserId) {
            return Rooms.setDMRoom(roomId, opts.dmUserId);
        } else {
            return q();
        }
    }).then(function() {
        // NB createRoom doesn't block on the client seeing the echo that the
        // room has been created, so we race here with the client knowing that
        // the room exists, causing things like
        // https://github.com/vector-im/vector-web/issues/1813
        dis.dispatch({
            action: 'view_room',
            room_id: roomId
        });
        return roomId;
    }, function(err) {
        Modal.createDialog(ErrorDialog, {
            title: "Failure to create room",
            description: err.toString()
        });
        return null;
    });
}

module.exports = createRoom;
