/*
Copyright 2019 New Vector Ltd
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

import dis from '../dispatcher/dispatcher';
import EventEmitter from 'events';
import {throttle} from "lodash";
import SettingsStore from "../settings/SettingsStore";
import RoomListStore, {LISTS_UPDATE_EVENT} from "./room-list/RoomListStore";
import {RoomNotificationStateStore} from "./notifications/RoomNotificationStateStore";
import {isCustomTag} from "./room-list/models";

function commonPrefix(a, b) {
    const len = Math.min(a.length, b.length);
    let prefix;
    for (let i = 0; i < len; ++i) {
        if (a.charAt(i) !== b.charAt(i)) {
            prefix = a.substr(0, i);
            break;
        }
    }
    if (prefix === undefined) {
        prefix = a.substr(0, len);
    }
    const spaceIdx = prefix.indexOf(' ');
    if (spaceIdx !== -1) {
        prefix = prefix.substr(0, spaceIdx + 1);
    }
    if (prefix.length >= 2) {
        return prefix;
    }
    return "";
}
/**
 * A class for storing application state for ordering tags in the TagPanel.
 */
class CustomRoomTagStore extends EventEmitter {
    constructor() {
        super();
        // Initialise state
        this._state = {tags: {}};

        // as RoomListStore gets updated by every timeline event
        // throttle this to only run every 500ms
        this._getUpdatedTags = throttle(
            this._getUpdatedTags, 500, {
                leading: true,
                trailing: true,
            },
        );
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this._onListsUpdated);
        dis.register(payload => this._onDispatch(payload));
    }

    getTags() {
        return this._state.tags;
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.emit("change");
    }

    addListener(callback) {
        this.on("change", callback);
        return {
            remove: () => {
                this.removeListener("change", callback);
            },
        };
    }

    getSortedTags() {
        const tagNames = Object.keys(this._state.tags).sort();
        const prefixes = tagNames.map((name, i) => {
            const isFirst = i === 0;
            const isLast = i === tagNames.length - 1;
            const backwardsPrefix = !isFirst ? commonPrefix(name, tagNames[i - 1]) : "";
            const forwardsPrefix = !isLast ? commonPrefix(name, tagNames[i + 1]) : "";
            const longestPrefix = backwardsPrefix.length > forwardsPrefix.length ?
                backwardsPrefix : forwardsPrefix;
            return longestPrefix;
        });
        return tagNames.map((name, i) => {
            const notifs = RoomNotificationStateStore.instance.getListState(name);
            let badgeNotifState;
            if (notifs.hasUnreadCount) {
                badgeNotifState = notifs;
            }
            const avatarLetter = name.substr(prefixes[i].length, 1);
            const selected = this._state.tags[name];
            return {name, avatarLetter, badgeNotifState, selected};
        });
    }

    _onListsUpdated = () => {
        this._setState({tags: this._getUpdatedTags()});
    };

    _onDispatch(payload) {
        switch (payload.action) {
            case 'select_custom_room_tag': {
                const oldTags = this._state.tags;
                if (oldTags.hasOwnProperty(payload.tag)) {
                    const tag = {};
                    tag[payload.tag] = !oldTags[payload.tag];
                    const tags = Object.assign({}, oldTags, tag);
                    this._setState({tags});
                }
            }
            break;
            case 'on_client_not_viable':
            case 'on_logged_out': {
                // we assume to always have a tags object in the state
                this._state = {tags: {}};
                RoomListStore.instance.off(LISTS_UPDATE_EVENT, this._onListsUpdated);
            }
            break;
        }
    }

    _getUpdatedTags() {
        if (!SettingsStore.isFeatureEnabled("feature_custom_tags")) {
            return;
        }

        const newTagNames = Object.keys(RoomListStore.instance.orderedLists).filter(t => isCustomTag(t)).sort();
        const prevTags = this._state && this._state.tags;
        return newTagNames.reduce((c, tagName) => {
            c[tagName] = (prevTags && prevTags[tagName]) || false;
            return c;
        }, {});
    }
}

if (global.singletonCustomRoomTagStore === undefined) {
    global.singletonCustomRoomTagStore = new CustomRoomTagStore();
}
export default global.singletonCustomRoomTagStore;
