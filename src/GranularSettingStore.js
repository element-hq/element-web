/*
Copyright 2017 Travis Ralston

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

import Promise from 'bluebird';
import MatrixClientPeg from './MatrixClientPeg';

const SETTINGS = [
    /*
    // EXAMPLE SETTING
    {
        name: "my-setting",
        type: "room", // or "account"
        ignoreLevels: [], // options: "device", "room-account", "account", "room"
                          // "room-account" and "room" don't apply for `type: account`.
        defaults: {
            your: "defaults",
        },
    },
    */

    // TODO: Populate this
];

// This controls the priority of particular handlers. Handler order should match the
// documentation throughout this file, as should the `types`. The priority is directly
// related to the index in the map, where index 0 is highest preference.
const PRIORITY_MAP = [
    {level: 'device', settingClass: DeviceSetting, types: ['room', 'account']},
    {level: 'room-account', settingClass: RoomAccountSetting, types: ['room']},
    {level: 'account', settingClass: AccountSetting, types: ['room', 'account']},
    {level: 'room', settingClass: RoomSetting, types: ['room']},
    {level: 'default', settingClass: DefaultSetting, types: ['room', 'account']},

    // TODO: Add support for 'legacy' settings (old events, etc)
    // TODO: Labs handler? (or make UserSettingsStore use this as a backend)
];

/**
 * Controls and manages application settings at different levels through a variety of
 * backends. Settings may be overridden at each level to provide the user with more
 * options for customization and tailoring of their experience. These levels are most
 * notably at the device, room, and account levels. The preferred order of levels is:
 * - per-device
 * - per-account in a particular room
 * - per-account
 * - per-room
 * - defaults (as defined here)
 *
 * There are two types of settings: Account and Room.
 *
 * Account Settings use the same preferences described above, but do not look at the
 * per-account in a particular room or the per-room levels. Account Settings are best
 * used for things like which theme the user would prefer.
 *
 * Room settings use the exact preferences described above. Room Settings are best
 * suited for settings which room administrators may want to define a default for the
 * room members, or where users may want an individual room to be different. Using the
 * setting definitions, particular preferences may be excluded to prevent, for example,
 * room administrators from defining that all messages should have timestamps when the
 * user may not want that. An example of a Room Setting would be URL previews.
 */
export default class GranularSettingStore {
    /**
     * Gets the content for an account setting.
     * @param {string} name The name of the setting to lookup
     * @returns {Promise<*>} Resolves to the content for the setting, or null if the
     * value cannot be found.
     */
    static getAccountSetting(name) {
        const handlers = GranularSettingStore._getHandlers('account');
        const initFn = (SettingClass) => new SettingClass('account', name);
        return GranularSettingStore._iterateHandlers(handlers, initFn);
    }

    /**
     * Gets the content for a room setting.
     * @param {string} name The name of the setting to lookup
     * @param {string} roomId The room ID to lookup the setting for
     * @returns {Promise<*>} Resolves to the content for the setting, or null if the
     * value cannot be found.
     */
    static getRoomSetting(name, roomId) {
        const handlers = GranularSettingStore._getHandlers('room');
        const initFn = (SettingClass) => new SettingClass('room', name, roomId);
        return GranularSettingStore._iterateHandlers(handlers, initFn);
    }

    static _iterateHandlers(handlers, initFn) {
        let index = 0;
        const wrapperFn = () => {
            // If we hit the end with no result, return 'not found'
            if (handlers.length >= index) return null;

            // Get the handler, increment the index, and create a setting object
            const handler = handlers[index++];
            const setting = initFn(handler.settingClass);

            // Try to read the value of the setting. If we get nothing for a value,
            // then try the next handler. Otherwise, return the value early.
            return Promise.resolve(setting.getValue()).then((value) => {
                if (!value) return wrapperFn();
                return value;
            });
        };
        return wrapperFn();
    }

    /**
     * Sets the content for a particular account setting at a given level in the hierarchy.
     * If the setting does not exist at the given level, this will attempt to create it. The
     * default level may not be modified.
     * @param {string} name The name of the setting.
     * @param {string} level The level to set the value of. Either 'device' or 'account'.
     * @param {Object} content The value for the setting, or null to clear the level's value.
     * @returns {Promise} Resolves when completed
     */
    static setAccountSetting(name, level, content) {
        const handler = GranularSettingStore._getHandler('account', level);
        if (!handler) throw new Error("Missing account setting handler for " + name + " at " + level);

        const SettingClass = handler.settingClass;
        const setting = new SettingClass('account', name);
        return Promise.resolve(setting.setValue(content));
    }

    /**
     * Sets the content for a particular room setting at a given level in the hierarchy. If
     * the setting does not exist at the given level, this will attempt to create it. The
     * default level may not be modified.
     * @param {string} name The name of the setting.
     * @param {string} level The level to set the value of. One of 'device', 'room-account',
     * 'account', or 'room'.
     * @param {string} roomId The room ID to set the value of.
     * @param {Object} content The value for the setting, or null to clear the level's value.
     * @returns {Promise} Resolves when completed
     */
    static setRoomSetting(name, level, roomId, content) {
        const handler = GranularSettingStore._getHandler('room', level);
        if (!handler) throw new Error("Missing room setting handler for " + name + " at " + level);

        const SettingClass = handler.settingClass;
        const setting = new SettingClass('room', name, roomId);
        return Promise.resolve(setting.setValue(content));
    }

    /**
     * Checks to ensure the current user may set the given account setting.
     * @param {string} name The name of the setting.
     * @param {string} level The level to check at. Either 'device' or 'account'.
     * @returns {boolean} Whether or not the current user may set the account setting value.
     */
    static canSetAccountSetting(name, level) {
        const handler = GranularSettingStore._getHandler('account', level);
        if (!handler) return false;

        const SettingClass = handler.settingClass;
        const setting = new SettingClass('account', name);
        return setting.canSetValue();
    }

    /**
     * Checks to ensure the current user may set the given room setting.
     * @param {string} name The name of the setting.
     * @param {string} level The level to check at. One of 'device', 'room-account', 'account',
     * or 'room'.
     * @param {string} roomId The room ID to check in.
     * @returns {boolean} Whether or not the current user may set the room setting value.
     */
    static canSetRoomSetting(name, level, roomId) {
        const handler = GranularSettingStore._getHandler('room', level);
        if (!handler) return false;

        const SettingClass = handler.settingClass;
        const setting = new SettingClass('room', name, roomId);
        return setting.canSetValue();
    }

    /**
     * Removes an account setting at a given level, forcing the level to inherit from an
     * earlier stage in the hierarchy.
     * @param {string} name The name of the setting.
     * @param {string} level The level to clear. Either 'device' or 'account'.
     */
    static removeAccountSetting(name, level) {
        // This is just a convenience method.
        GranularSettingStore.setAccountSetting(name, level, null);
    }

    /**
     * Removes a room setting at a given level, forcing the level to inherit from an earlier
     * stage in the hierarchy.
     * @param {string} name The name of the setting.
     * @param {string} level The level to clear. One of 'device', 'room-account', 'account',
     * or 'room'.
     * @param {string} roomId The room ID to clear the setting on.
     */
    static removeRoomSetting(name, level, roomId) {
        // This is just a convenience method.
        GranularSettingStore.setRoomSetting(name, level, roomId, null);
    }

    /**
     * Determines whether or not a particular level is supported on the current platform.
     * @param {string} level The level to check. One of 'device', 'room-account', 'account',
     * 'room', or 'default'.
     * @returns {boolean} Whether or not the level is supported.
     */
    static isLevelSupported(level) {
        return GranularSettingStore._getHandlersAtLevel(level).length > 0;
    }

    static _getHandlersAtLevel(level) {
        return PRIORITY_MAP.filter((h) => h.level === level && h.settingClass.isSupported());
    }

    static _getHandlers(type) {
        return PRIORITY_MAP.filter((h) => {
            if (!h.types.includes(type)) return false;
            if (!h.settingClass.isSupported()) return false;

            return true;
        });
    }

    static _getHandler(type, level) {
        const handlers = GranularSettingStore._getHandlers(type);
        return handlers.filter((h) => h.level === level)[0];
    }
}

// Validate of properties is assumed to be done well prior to instantiation of these classes,
// therefore these classes don't do any sanity checking. The following interface is assumed:
//   constructor(type, name, roomId)   - roomId may be null for type=='account'
//   getValue()   - returns a promise for the value. Falsey resolves are treated as 'not found'.
//   setValue(content)   - sets the new value for the setting. Falsey should remove the value.
//   canSetValue()   - returns true if the current user can set this setting.
//   static isSupported()   - returns true if the setting type is supported

class DefaultSetting {
    constructor(type, name, roomId = null) {
        this.type = type;
        this.name = name;
        this.roomId = roomId;
    }

    getValue() {
        for (const setting of SETTINGS) {
            if (setting.type === this.type && setting.name === this.name) {
                return setting.defaults;
            }
        }

        return null;
    }

    setValue() {
        throw new Error("Operation not permitted: Cannot set value of a default setting.");
    }

    canSetValue() {
        // It's a default, so no, you can't.
        return false;
    }

    static isSupported() {
        return true; // defaults are always accepted
    }
}

class DeviceSetting {
    constructor(type, name, roomId = null) {
        this.type = type;
        this.name = name;
        this.roomId = roomId;
    }

    _getKey() {
        return "mx_setting_" + this.name + "_" + this.type;
    }

    getValue() {
        if (!localStorage) return null;
        const value = localStorage.getItem(this._getKey());
        if (!value) return null;
        return JSON.parse(value);
    }

    setValue(content) {
        if (!localStorage) throw new Error("Operation not possible: No device storage available.");
        if (!content) localStorage.removeItem(this._getKey());
        else localStorage.setItem(this._getKey(), JSON.stringify(content));
    }

    canSetValue() {
        // The user likely has control over their own localstorage.
        return true;
    }

    static isSupported() {
        // We can only do something if we have localstorage
        return !!localStorage;
    }
}

class RoomAccountSetting {
    constructor(type, name, roomId = null) {
        this.type = type;
        this.name = name;
        this.roomId = roomId;
    }

    _getEventType() {
        return "im.vector.setting." + this.type + "." + this.name;
    }

    getValue() {
        if (!MatrixClientPeg.get()) return null;

        const room = MatrixClientPeg.getRoom(this.roomId);
        if (!room) return null;

        const event = room.getAccountData(this._getEventType());
        if (!event || !event.getContent()) return null;

        return event.getContent();
    }

    setValue(content) {
        if (!MatrixClientPeg.get()) throw new Error("Operation not possible: No client peg");
        return MatrixClientPeg.get().setRoomAccountData(this.roomId, this._getEventType(), content);
    }

    canSetValue() {
        // It's their own room account data, so they should be able to set it.
        return true;
    }

    static isSupported() {
        // We can only do something if we have a client
        return !!MatrixClientPeg.get();
    }
}

class AccountSetting {
    constructor(type, name, roomId = null) {
        this.type = type;
        this.name = name;
        this.roomId = roomId;
    }

    _getEventType() {
        return "im.vector.setting." + this.type + "." + this.name;
    }

    getValue() {
        if (!MatrixClientPeg.get()) return null;
        return MatrixClientPeg.getAccountData(this._getEventType());
    }

    setValue(content) {
        if (!MatrixClientPeg.get()) throw new Error("Operation not possible: No client peg");
        return MatrixClientPeg.setAccountData(this._getEventType(), content);
    }

    canSetValue() {
        // It's their own account data, so they should be able to set it
        return true;
    }

    static isSupported() {
        // We can only do something if we have a client
        return !!MatrixClientPeg.get();
    }
}

class RoomSetting {
    constructor(type, name, roomId = null) {
        this.type = type;
        this.name = name;
        this.roomId = roomId;
    }

    _getEventType() {
        return "im.vector.setting." + this.type + "." + this.name;
    }

    getValue() {
        if (!MatrixClientPeg.get()) return null;

        const room = MatrixClientPeg.get().getRoom(this.roomId);
        if (!room) return null;

        const stateEvent = room.currentState.getStateEvents(this._getEventType(), "");
        if (!stateEvent || !stateEvent.getContent()) return null;

        return stateEvent.getContent();
    }

    setValue(content) {
        if (!MatrixClientPeg.get()) throw new Error("Operation not possible: No client peg");

        return MatrixClientPeg.get().sendStateEvent(this.roomId, this._getEventType(), content, "");
    }

    canSetValue() {
        const cli = MatrixClientPeg.get();

        const room = cli.getRoom(this.roomId);
        if (!room) return false; // They're not in the room, likely.

        return room.currentState.maySendStateEvent(this._getEventType(), cli.getUserId());
    }

    static isSupported() {
        // We can only do something if we have a client
        return !!MatrixClientPeg.get();
    }
}
