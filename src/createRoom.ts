/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {MatrixClient} from "matrix-js-sdk/src/client";
import {Room} from "matrix-js-sdk/src/models/room";

import {MatrixClientPeg} from './MatrixClientPeg';
import Modal from './Modal';
import * as sdk from './index';
import { _t } from './languageHandler';
import dis from "./dispatcher/dispatcher";
import * as Rooms from "./Rooms";
import DMRoomMap from "./utils/DMRoomMap";
import {getAddressType} from "./UserAddress";
import { getE2EEWellKnown } from "./utils/WellKnownUtils";
import GroupStore from "./stores/GroupStore";

// we define a number of interfaces which take their names from the js-sdk
/* eslint-disable camelcase */

// TODO move these interfaces over to js-sdk once it has been typescripted enough to accept them
enum Visibility {
    Public = "public",
    Private = "private",
}

enum Preset {
    PrivateChat = "private_chat",
    TrustedPrivateChat = "trusted_private_chat",
    PublicChat = "public_chat",
}

interface Invite3PID {
    id_server: string;
    id_access_token?: string; // this gets injected by the js-sdk
    medium: string;
    address: string;
}

interface IStateEvent {
    type: string;
    state_key?: string; // defaults to an empty string
    content: object;
}

interface ICreateOpts {
    visibility?: Visibility;
    room_alias_name?: string;
    name?: string;
    topic?: string;
    invite?: string[];
    invite_3pid?: Invite3PID[];
    room_version?: string;
    creation_content?: object;
    initial_state?: IStateEvent[];
    preset?: Preset;
    is_direct?: boolean;
    power_level_content_override?: object;
}

interface IOpts {
    dmUserId?: string;
    createOpts?: ICreateOpts;
    spinner?: boolean;
    guestAccess?: boolean;
    encryption?: boolean;
    inlineErrors?: boolean;
    andView?: boolean;
    associatedWithCommunity?: string;
}

/**
 * Create a new room, and switch to it.
 *
 * @param {object=} opts parameters for creating the room
 * @param {string=} opts.dmUserId If specified, make this a DM room for this user and invite them
 * @param {object=} opts.createOpts set of options to pass to createRoom call.
 * @param {bool=} opts.spinner True to show a modal spinner while the room is created.
 *     Default: True
 * @param {bool=} opts.guestAccess Whether to enable guest access.
 *     Default: True
 * @param {bool=} opts.encryption Whether to enable encryption.
 *     Default: False
 * @param {bool=} opts.inlineErrors True to raise errors off the promise instead of resolving to null.
 *     Default: False
 * @param {bool=} opts.andView True to dispatch an action to view the room once it has been created.
 *
 * @returns {Promise} which resolves to the room id, or null if the
 * action was aborted or failed.
 */
export default function createRoom(opts: IOpts): Promise<string | null> {
    opts = opts || {};
    if (opts.spinner === undefined) opts.spinner = true;
    if (opts.guestAccess === undefined) opts.guestAccess = true;
    if (opts.encryption === undefined) opts.encryption = false;

    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
    const Loader = sdk.getComponent("elements.Spinner");

    const client = MatrixClientPeg.get();
    if (client.isGuest()) {
        dis.dispatch({action: 'require_registration'});
        return Promise.resolve(null);
    }

    const defaultPreset = opts.dmUserId ? Preset.TrustedPrivateChat : Preset.PrivateChat;

    // set some defaults for the creation
    const createOpts = opts.createOpts || {};
    createOpts.preset = createOpts.preset || defaultPreset;
    createOpts.visibility = createOpts.visibility || Visibility.Private;
    if (opts.dmUserId && createOpts.invite === undefined) {
        switch (getAddressType(opts.dmUserId)) {
            case 'mx-user-id':
                createOpts.invite = [opts.dmUserId];
                break;
            case 'email':
                createOpts.invite_3pid = [{
                    id_server: MatrixClientPeg.get().getIdentityServerUrl(true),
                    medium: 'email',
                    address: opts.dmUserId,
                }];
        }
    }
    if (opts.dmUserId && createOpts.is_direct === undefined) {
        createOpts.is_direct = true;
    }

    // By default, view the room after creating it
    if (opts.andView === undefined) {
        opts.andView = true;
    }

    createOpts.initial_state = createOpts.initial_state || [];

    // Allow guests by default since the room is private and they'd
    // need an invite. This means clicking on a 3pid invite email can
    // actually drop you right in to a chat.
    if (opts.guestAccess) {
        createOpts.initial_state.push({
            type: 'm.room.guest_access',
            state_key: '',
            content: {
                guest_access: 'can_join',
            },
        });
    }

    if (opts.encryption) {
        createOpts.initial_state.push({
            type: 'm.room.encryption',
            state_key: '',
            content: {
                algorithm: 'm.megolm.v1.aes-sha2',
            },
        });
    }

    let modal;
    if (opts.spinner) modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');

    let roomId;
    return client.createRoom(createOpts).finally(function() {
        if (modal) modal.close();
    }).then(function(res) {
        roomId = res.room_id;
        if (opts.dmUserId) {
            return Rooms.setDMRoom(roomId, opts.dmUserId);
        } else {
            return Promise.resolve();
        }
    }).then(() => {
        if (opts.associatedWithCommunity) {
            return GroupStore.addRoomToGroup(opts.associatedWithCommunity, roomId, false);
        }
    }).then(function() {
        // NB createRoom doesn't block on the client seeing the echo that the
        // room has been created, so we race here with the client knowing that
        // the room exists, causing things like
        // https://github.com/vector-im/vector-web/issues/1813
        if (opts.andView) {
            dis.dispatch({
                action: 'view_room',
                room_id: roomId,
                should_peek: false,
                // Creating a room will have joined us to the room,
                // so we are expecting the room to come down the sync
                // stream, if it hasn't already.
                joining: true,
            });
        }
        return roomId;
    }, function(err) {
        // Raise the error if the caller requested that we do so.
        if (opts.inlineErrors) throw err;

        // We also failed to join the room (this sets joining to false in RoomViewStore)
        dis.dispatch({
            action: 'join_room_error',
        });
        console.error("Failed to create room " + roomId + " " + err);
        let description = _t("Server may be unavailable, overloaded, or you hit a bug.");
        if (err.errcode === "M_UNSUPPORTED_ROOM_VERSION") {
            // Technically not possible with the UI as of April 2019 because there's no
            // options for the user to change this. However, it's not a bad thing to report
            // the error to the user for if/when the UI is available.
            description = _t("The server does not support the room version specified.");
        }
        Modal.createTrackedDialog('Failure to create room', '', ErrorDialog, {
            title: _t("Failure to create room"),
            description,
        });
        return null;
    });
}

export function findDMForUser(client: MatrixClient, userId: string): Room {
    const roomIds = DMRoomMap.shared().getDMRoomsForUserId(userId);
    const rooms = roomIds.map(id => client.getRoom(id));
    const suitableDMRooms = rooms.filter(r => {
        if (r && r.getMyMembership() === "join") {
            const member = r.getMember(userId);
            return member && (member.membership === "invite" || member.membership === "join");
        }
        return false;
    }).sort((r1, r2) => {
        return r2.getLastActiveTimestamp() -
            r1.getLastActiveTimestamp();
    });
    if (suitableDMRooms.length) {
        return suitableDMRooms[0];
    }
}

/*
 * Try to ensure the user is already in the megolm session before continuing
 * NOTE: this assumes you've just created the room and there's not been an opportunity
 * for other code to run, so we shouldn't miss RoomState.newMember when it comes by.
 */
export async function _waitForMember(client: MatrixClient, roomId: string, userId: string, opts = { timeout: 1500 }) {
    const { timeout } = opts;
    let handler;
    return new Promise((resolve) => {
        handler = function(_event, _roomstate, member) {
            if (member.userId !== userId) return;
            if (member.roomId !== roomId) return;
            resolve(true);
        };
        client.on("RoomState.newMember", handler);

        /* We don't want to hang if this goes wrong, so we proceed and hope the other
           user is already in the megolm session */
        setTimeout(resolve, timeout, false);
    }).finally(() => {
        client.removeListener("RoomState.newMember", handler);
    });
}

/*
 * Ensure that for every user in a room, there is at least one device that we
 * can encrypt to.
 */
export async function canEncryptToAllUsers(client: MatrixClient, userIds: string[]) {
    const usersDeviceMap = await client.downloadKeys(userIds);
    // { "@user:host": { "DEVICE": {...}, ... }, ... }
    return Object.values(usersDeviceMap).every((userDevices) =>
        // { "DEVICE": {...}, ... }
        Object.keys(userDevices).length > 0,
    );
}

export async function ensureDMExists(client: MatrixClient, userId: string): Promise<string> {
    const existingDMRoom = findDMForUser(client, userId);
    let roomId;
    if (existingDMRoom) {
        roomId = existingDMRoom.roomId;
    } else {
        let encryption;
        if (privateShouldBeEncrypted()) {
            encryption = canEncryptToAllUsers(client, [userId]);
        }
        roomId = await createRoom({encryption, dmUserId: userId, spinner: false, andView: false});
        await _waitForMember(client, roomId, userId);
    }
    return roomId;
}

export function privateShouldBeEncrypted(): boolean {
    const e2eeWellKnown = getE2EEWellKnown();
    if (e2eeWellKnown) {
        const defaultDisabled = e2eeWellKnown["default"] === false;
        return !defaultDisabled;
    }
    return true;
}
