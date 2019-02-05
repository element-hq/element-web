/*
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
import {Store} from 'flux/utils';
import dis from '../dispatcher';
import RoomListStore from './RoomListStore';
const STANDARD_TAGS_REGEX = /^(m\.(favourite|lowpriority|server_notice)|im\.vector\.fake\.(invite|recent|direct|archived))$/;

/**
 * A class for storing application state for ordering tags in the TagPanel.
 */
class CustomRoomTagStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = Object.assign({}, {tags: this._getUpdatedTags()});

        this._roomListStoreToken = RoomListStore.addListener(() => {
            // UGLY: FluxStore doens't emit changes that
            // didn't come from a dispatcher action
            // so emit the change ourselves for now ...
            this._state.tags = this._getUpdatedTags();
            this.__emitter.emit("change");
        });
    }

    getTags() {
        return this._state.tags;
    }

    getSortedTags() {this._state.tags
        return Object.keys(this._state.tags).sort().map((name) => {
            return {name, selected: this._state.tags[name]};
        });
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
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
            case 'deselect_custom_room_tags': {
                const tags = Object.keys(this._state.tags)
                    .reduce((tags, tagName) => {
                        tags[tagName] = false;
                        return tags;
                    }, {});
                this._setState({tags});
            }
            break;
            case 'on_logged_out': {
                this._state = {};
                if (this._roomListStoreToken) {
                    this._roomListStoreToken.remove();
                    this._roomListStoreToken = null;
                }
            }
            break;
        }
    }

    _getUpdatedTags() {
        const newTagNames = Object.keys(RoomListStore.getRoomLists())
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
