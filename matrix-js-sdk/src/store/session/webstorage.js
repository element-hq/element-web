/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
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

/**
 * @module store/session/webstorage
 */

import * as utils from "../../utils";
import { logger } from '../../logger';

const DEBUG = false;  // set true to enable console logging.
const E2E_PREFIX = "session.e2e.";

/**
 * Construct a web storage session store, capable of storing account keys,
 * session keys and access tokens.
 * @constructor
 * @param {WebStorage} webStore A web storage implementation, e.g.
 * 'window.localStorage' or 'window.sessionStorage' or a custom implementation.
 * @throws if the supplied 'store' does not meet the Storage interface of the
 * WebStorage API.
 */
export function WebStorageSessionStore(webStore) {
    this.store = webStore;
    if (!utils.isFunction(webStore.getItem) ||
        !utils.isFunction(webStore.setItem) ||
        !utils.isFunction(webStore.removeItem) ||
        !utils.isFunction(webStore.key) ||
        typeof(webStore.length) !== 'number'
       ) {
        throw new Error(
            "Supplied webStore does not meet the WebStorage API interface",
        );
    }
}

WebStorageSessionStore.prototype = {
    /**
     * Remove the stored end to end account for the logged-in user.
     */
    removeEndToEndAccount: function() {
        this.store.removeItem(KEY_END_TO_END_ACCOUNT);
    },

    /**
     * Load the end to end account for the logged-in user.
     * Note that the end-to-end account is now stored in the
     * crypto store rather than here: this remains here so
     * old sessions can be migrated out of the session store.
     * @return {?string} Base64 encoded account.
     */
    getEndToEndAccount: function() {
        return this.store.getItem(KEY_END_TO_END_ACCOUNT);
    },

    /**
     * Retrieves the known devices for all users.
     * @return {object} A map from user ID to map of device ID to keys for the device.
     */
    getAllEndToEndDevices: function() {
        const prefix = keyEndToEndDevicesForUser('');
        const devices = {};
        for (let i = 0; i < this.store.length; ++i) {
            const key = this.store.key(i);
            const userId = key.substr(prefix.length);
            if (key.startsWith(prefix)) devices[userId] = getJsonItem(this.store, key);
        }
        return devices;
    },

    getEndToEndDeviceTrackingStatus: function() {
        return getJsonItem(this.store, KEY_END_TO_END_DEVICE_LIST_TRACKING_STATUS);
    },

    /**
     * Get the sync token corresponding to the device list.
     *
     * @return {String?} token
     */
    getEndToEndDeviceSyncToken: function() {
        return getJsonItem(this.store, KEY_END_TO_END_DEVICE_SYNC_TOKEN);
    },

    /**
     * Removes all end to end device data from the store
     */
    removeEndToEndDeviceData: function() {
        removeByPrefix(this.store, keyEndToEndDevicesForUser(''));
        removeByPrefix(this.store, KEY_END_TO_END_DEVICE_LIST_TRACKING_STATUS);
        removeByPrefix(this.store, KEY_END_TO_END_DEVICE_SYNC_TOKEN);
    },

    /**
     * Retrieve the end-to-end sessions between the logged-in user and another
     * device.
     * @param {string} deviceKey The public key of the other device.
     * @return {object} A map from sessionId to Base64 end-to-end session.
     */
    getEndToEndSessions: function(deviceKey) {
        return getJsonItem(this.store, keyEndToEndSessions(deviceKey));
    },

    /**
     * Retrieve all end-to-end sessions between the logged-in user and other
     * devices.
     * @return {object} A map of {deviceKey -> {sessionId -> session pickle}}
     */
    getAllEndToEndSessions: function() {
        const deviceKeys = getKeysWithPrefix(this.store, keyEndToEndSessions(''));
        const results = {};
        for (const k of deviceKeys) {
            const unprefixedKey = k.substr(keyEndToEndSessions('').length);
            results[unprefixedKey] = getJsonItem(this.store, k);
        }
        return results;
    },

    /**
     * Remove all end-to-end sessions from the store
     * This is used after migrating sessions awat from the sessions store.
     */
    removeAllEndToEndSessions: function() {
        removeByPrefix(this.store, keyEndToEndSessions(''));
    },

    /**
     * Retrieve a list of all known inbound group sessions
     *
     * @return {{senderKey: string, sessionId: string}}
     */
    getAllEndToEndInboundGroupSessionKeys: function() {
        const prefix = E2E_PREFIX + 'inboundgroupsessions/';
        const result = [];
        for (let i = 0; i < this.store.length; i++) {
            const key = this.store.key(i);
            if (!key.startsWith(prefix)) {
                continue;
            }
            // we can't use split, as the components we are trying to split out
            // might themselves contain '/' characters. We rely on the
            // senderKey being a (32-byte) curve25519 key, base64-encoded
            // (hence 43 characters long).

            result.push({
                senderKey: key.substr(prefix.length, 43),
                sessionId: key.substr(prefix.length + 44),
            });
        }
        return result;
    },

    getEndToEndInboundGroupSession: function(senderKey, sessionId) {
        const key = keyEndToEndInboundGroupSession(senderKey, sessionId);
        return this.store.getItem(key);
    },

    removeAllEndToEndInboundGroupSessions: function() {
        removeByPrefix(this.store, E2E_PREFIX + 'inboundgroupsessions/');
    },

    /**
     * Get the end-to-end state for all rooms
     * @return {object} roomId -> object with the end-to-end info for the room.
     */
    getAllEndToEndRooms: function() {
        const roomKeys = getKeysWithPrefix(this.store, keyEndToEndRoom(''));
        const results = {};
        for (const k of roomKeys) {
            const unprefixedKey = k.substr(keyEndToEndRoom('').length);
            results[unprefixedKey] = getJsonItem(this.store, k);
        }
        return results;
    },

    removeAllEndToEndRooms: function() {
        removeByPrefix(this.store, keyEndToEndRoom(''));
    },

    setLocalTrustedBackupPubKey: function(pubkey) {
        this.store.setItem(KEY_END_TO_END_TRUSTED_BACKUP_PUBKEY, pubkey);
    },

    // XXX: This store is deprecated really, but added this as a temporary
    // thing until cross-signing lands.
    getLocalTrustedBackupPubKey: function() {
        return this.store.getItem(KEY_END_TO_END_TRUSTED_BACKUP_PUBKEY);
    },
};

const KEY_END_TO_END_ACCOUNT = E2E_PREFIX + "account";
const KEY_END_TO_END_DEVICE_SYNC_TOKEN = E2E_PREFIX + "device_sync_token";
const KEY_END_TO_END_DEVICE_LIST_TRACKING_STATUS = E2E_PREFIX + "device_tracking";
const KEY_END_TO_END_TRUSTED_BACKUP_PUBKEY = E2E_PREFIX + "trusted_backup_pubkey";

function keyEndToEndDevicesForUser(userId) {
    return E2E_PREFIX + "devices/" + userId;
}

function keyEndToEndSessions(deviceKey) {
    return E2E_PREFIX + "sessions/" + deviceKey;
}

function keyEndToEndInboundGroupSession(senderKey, sessionId) {
    return E2E_PREFIX + "inboundgroupsessions/" + senderKey + "/" + sessionId;
}

function keyEndToEndRoom(roomId) {
    return E2E_PREFIX + "rooms/" + roomId;
}

function getJsonItem(store, key) {
    try {
        // if the key is absent, store.getItem() returns null, and
        // JSON.parse(null) === null, so this returns null.
        return JSON.parse(store.getItem(key));
    } catch (e) {
        debuglog("Failed to get key %s: %s", key, e);
        debuglog(e.stack);
    }
    return null;
}

function getKeysWithPrefix(store, prefix) {
    const results = [];
    for (let i = 0; i < store.length; ++i) {
        const key = store.key(i);
        if (key.startsWith(prefix)) results.push(key);
    }
    return results;
}

function removeByPrefix(store, prefix) {
    const toRemove = [];
    for (let i = 0; i < store.length; ++i) {
        const key = store.key(i);
        if (key.startsWith(prefix)) toRemove.push(key);
    }
    for (const key of toRemove) {
        store.removeItem(key);
    }
}

function debuglog(...args) {
    if (DEBUG) {
        logger.log(...args);
    }
}
