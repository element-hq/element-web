/*
Copyright 2019 New Vector Ltd

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
import * as RoomNotifs from '../RoomNotifs';
import EventEmitter from 'events';
import { throttle } from "lodash";
import SettingsStore from "../settings/SettingsStore";
import {RoomListStoreTempProxy} from "./room-list/RoomListStoreTempProxy";

const STANDARD_TAGS_REGEX = /^(m\.(favourite|lowpriority|server_notice)|im\.vector\.fake\.(invite|recent|direct|archived))$/;

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
        this._roomListStoreToken = RoomListStoreTempProxy.addListener(() => {
            this._setState({tags: this._getUpdatedTags()});
        });
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
        const roomLists = RoomListStoreTempProxy.getRoomLists();

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
            const notifs = RoomNotifs.aggregateNotificationCount(roomLists[name]);
            let badge;
            if (notifs.count !== 0) {
                badge = notifs;
            }
            const avatarLetter = name.substr(prefixes[i].length, 1);
            const selected = this._state.tags[name];
            return {name, avatarLetter, badge, selected};
        });
    }


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
                if (this._roomListStoreToken) {
                    this._roomListStoreToken.remove();
                    this._roomListStoreToken = null;
                }
            }
            break;
        }
    }

    _getUpdatedTags() {
        if (!SettingsStore.isFeatureEnabled("feature_custom_tags")) {
            return;
        }

        const newTagNames = Object.keys(RoomListStoreTempProxy.getRoomLists())
            .filter((tagName) => {
                return !tagName.match(STANDARD_TAGS_REGEX);
            }).sort();
        const prevTags = this._state && this._state.tags;
        const newTags = newTagNames.reduce((newTags, tagName) => {
            newTags[tagName] = (prevTags && prevTags[tagName]) || false;
            return newTags;
        }, {});
        return newTags;
    }
}

if (global.singletonCustomRoomTagStore === undefined) {
    global.singletonCustomRoomTagStore = new CustomRoomTagStore();
}
export default global.singletonCustomRoomTagStore;
