/*
Copyright 2017 Vector Creations Ltd

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
import Analytics from '../Analytics';
import MatrixClientPeg from "../MatrixClientPeg";

const INITIAL_STATE = {
    orderedTags: null,
    allTags: null,
};

/**
 * A class for storing application state for ordering tags in the TagPanel.
 */
class TagOrderStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            // Get ordering from account data
            case 'MatrixActions.accountData': {
                if (payload.event_type !== 'im.vector.web.tag_ordering') break;
                this._setState({
                    orderedTags: payload.event_content ? payload.event_content.tags : null,
                });
                break;
            }
            // Initialise the state such that if account data is unset, default to joined groups
            case 'GroupActions.fetchJoinedGroups.success':
                this._setState({
                    allTags: payload.result.groups.sort(), // Sort lexically
                });
            break;
            // Puts payload.tag at payload.targetTag, placing the targetTag before or after the tag
            case 'order_tag': {
                if (!payload.tag || !payload.targetTag || payload.tag === payload.targetTag) return;

                const tags = this._state.orderedTags || this._state.allTags;

                let orderedTags = tags.filter((t) => t !== payload.tag);
                const newIndex = orderedTags.indexOf(payload.targetTag) + (payload.after ? 1 : 0);
                orderedTags = [
                    ...orderedTags.slice(0, newIndex),
                    payload.tag,
                    ...orderedTags.slice(newIndex),
                ];
                this._setState({orderedTags});
            }
            break;
            case 'commit_tags':
                MatrixClientPeg.get().setAccountData('im.vector.web.tag_ordering', {tags: this._state.orderedTags});
                Analytics.trackEvent('TagOrderStore', 'commit_tags');
            break;
        }
    }

    getOrderedTags() {
        return this._state.orderedTags;
    }

    getAllTags() {
        return this._state.allTags;
    }
}

if (global.singletonTagOrderStore === undefined) {
    global.singletonTagOrderStore = new TagOrderStore();
}
export default global.singletonTagOrderStore;
