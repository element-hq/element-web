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

const INITIAL_STATE = {
    orderedTags: null,
    orderedTagsAccountData: null,
    hasSynced: false,
    joinedGroupIds: null,
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
            // Initialise state after initial sync
            case 'MatrixSync': {
                if (!(payload.prevState === 'PREPARED' && payload.state === 'SYNCING')) {
                    break;
                }
                const tagOrderingEvent = payload.matrixClient.getAccountData('im.vector.web.tag_ordering');
                const tagOrderingEventContent = tagOrderingEvent ? tagOrderingEvent.getContent() : {};
                this._setState({
                    orderedTagsAccountData: tagOrderingEventContent.tags || null,
                    hasSynced: true,
                });
                this._updateOrderedTags();
                break;
            }
            // Get ordering from account data
            case 'MatrixActions.accountData': {
                if (payload.event_type !== 'im.vector.web.tag_ordering') break;
                this._setState({
                    orderedTagsAccountData: payload.event_content ? payload.event_content.tags : null,
                });
                this._updateOrderedTags();
                break;
            }
            // Initialise the state such that if account data is unset, default to joined groups
            case 'GroupActions.fetchJoinedGroups.success': {
                this._setState({
                    joinedGroupIds: payload.result.groups.sort(), // Sort lexically
                    hasFetchedJoinedGroups: true,
                });
                this._updateOrderedTags();
                break;
            }
            // Puts payload.tag at payload.targetTag, placing the targetTag before or after the tag
            case 'order_tag': {
                if (!this._state.orderedTags ||
                    !payload.tag ||
                    !payload.targetTag ||
                    payload.tag === payload.targetTag
                ) return;

                const tags = this._state.orderedTags;

                let orderedTags = tags.filter((t) => t !== payload.tag);
                const newIndex = orderedTags.indexOf(payload.targetTag) + (payload.after ? 1 : 0);
                orderedTags = [
                    ...orderedTags.slice(0, newIndex),
                    payload.tag,
                    ...orderedTags.slice(newIndex),
                ];
                this._setState({orderedTags});
                break;
            }
        }
    }

    _updateOrderedTags() {
        this._setState({
            orderedTags:
                this._state.hasSynced &&
                this._state.hasFetchedJoinedGroups ?
                    this._mergeGroupsAndTags() : null,
        });
    }

    _mergeGroupsAndTags() {
        const groupIds = this._state.joinedGroupIds || [];
        const tags = this._state.orderedTagsAccountData || [];

        const tagsToKeep = tags.filter(
            (t) => t[0] !== '+' || groupIds.includes(t),
        );

        const groupIdsToAdd = groupIds.filter(
            (groupId) => !tags.includes(groupId),
        );

        return tagsToKeep.concat(groupIdsToAdd);
    }

    getOrderedTags() {
        return this._state.orderedTags;
    }
}

if (global.singletonTagOrderStore === undefined) {
    global.singletonTagOrderStore = new TagOrderStore();
}
export default global.singletonTagOrderStore;
