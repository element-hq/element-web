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
import dis from '../dispatcher/dispatcher';
import GroupStore from './GroupStore';
import Analytics from '../Analytics';
import * as RoomNotifs from "../RoomNotifs";
import {MatrixClientPeg} from '../MatrixClientPeg';
import SettingsStore from "../settings/SettingsStore";

const INITIAL_STATE = {
    orderedTags: null,
    orderedTagsAccountData: null,
    hasSynced: false,
    joinedGroupIds: null,

    selectedTags: [],
    // Last selected tag when shift was not being pressed
    anchorTag: null,
};

/**
 * A class for storing application state for ordering tags in the TagPanel.
 */
class TagOrderStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = Object.assign({}, INITIAL_STATE);
        SettingsStore.monitorSetting("TagPanel.enableTagPanel", null);
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            // Initialise state after initial sync
            case 'view_room': {
                const relatedGroupIds = GroupStore.getGroupIdsForRoomId(payload.room_id);
                this._updateBadges(relatedGroupIds);
                break;
            }
            case 'MatrixActions.sync': {
                if (payload.state === 'SYNCING' || payload.state === 'PREPARED') {
                    this._updateBadges();
                }
                if (!(payload.prevState !== 'PREPARED' && payload.state === 'PREPARED')) {
                    break;
                }
                const tagOrderingEvent = payload.matrixClient.getAccountData('im.vector.web.tag_ordering');
                const tagOrderingEventContent = tagOrderingEvent ? tagOrderingEvent.getContent() : {};
                this._setState({
                    orderedTagsAccountData: tagOrderingEventContent.tags || null,
                    removedTagsAccountData: tagOrderingEventContent.removedTags || null,
                    hasSynced: true,
                });
                this._updateOrderedTags();
                break;
            }
            // Get ordering from account data
            case 'MatrixActions.accountData': {
                if (payload.event_type !== 'im.vector.web.tag_ordering') break;

                // Ignore remote echos caused by this store so as to avoid setting
                // state back to old state.
                if (payload.event_content._storeId === this.getStoreId()) break;

                this._setState({
                    orderedTagsAccountData: payload.event_content ? payload.event_content.tags : null,
                    removedTagsAccountData: payload.event_content ? payload.event_content.removedTags : null,
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
            case 'TagOrderActions.moveTag.pending': {
                // Optimistic update of a moved tag
                this._setState({
                    orderedTags: payload.request.tags,
                    removedTagsAccountData: payload.request.removedTags,
                });
                break;
            }
            case 'TagOrderActions.removeTag.pending': {
                // Optimistic update of a removed tag
                this._setState({
                    removedTagsAccountData: payload.request.removedTags,
                });
                this._updateOrderedTags();
                break;
            }
            case 'select_tag': {
                const allowMultiple = !SettingsStore.getValue("feature_communities_v2_prototypes");

                let newTags = [];
                // Shift-click semantics
                if (payload.shiftKey && allowMultiple) {
                    // Select range of tags
                    let start = this._state.orderedTags.indexOf(this._state.anchorTag);
                    let end = this._state.orderedTags.indexOf(payload.tag);

                    if (start === -1) {
                        start = end;
                    }
                    if (start > end) {
                        const temp = start;
                        start = end;
                        end = temp;
                    }
                    newTags = payload.ctrlOrCmdKey ? this._state.selectedTags : [];
                    newTags = [...new Set(
                        this._state.orderedTags.slice(start, end + 1).concat(newTags),
                    )];
                } else {
                    if (payload.ctrlOrCmdKey && allowMultiple) {
                        // Toggle individual tag
                        if (this._state.selectedTags.includes(payload.tag)) {
                            newTags = this._state.selectedTags.filter((t) => t !== payload.tag);
                        } else {
                            newTags = [...this._state.selectedTags, payload.tag];
                        }
                    } else {
                        if (this._state.selectedTags.length === 1 && this._state.selectedTags.includes(payload.tag)) {
                            // Existing (only) selected tag is being normally clicked again, clear tags
                            newTags = [];
                        } else {
                            // Select individual tag
                            newTags = [payload.tag];
                        }
                    }
                    // Only set the anchor tag if the tag was previously unselected, otherwise
                    // the next range starts with an unselected tag.
                    if (!this._state.selectedTags.includes(payload.tag)) {
                        this._setState({
                            anchorTag: payload.tag,
                        });
                    }
                }

                this._setState({
                    selectedTags: newTags,
                });

                Analytics.trackEvent('FilterStore', 'select_tag');
            }
            break;
            case 'deselect_tags':
                if (payload.tag) {
                    // if a tag is passed, only deselect that tag
                    this._setState({
                        selectedTags: this._state.selectedTags.filter(tag => tag !== payload.tag),
                    });
                } else {
                    this._setState({
                        selectedTags: [],
                    });
                }
                Analytics.trackEvent('FilterStore', 'deselect_tags');
            break;
            case 'on_client_not_viable':
            case 'on_logged_out': {
                // Reset state without pushing an update to the view, which generally assumes that
                // the matrix client isn't `null` and so causing a re-render will cause NPEs.
                this._state = Object.assign({}, INITIAL_STATE);
                break;
            }
            case 'setting_updated':
                if (payload.settingName === 'TagPanel.enableTagPanel' && !payload.newValue) {
                    this._setState({
                        selectedTags: [],
                    });
                    Analytics.trackEvent('FilterStore', 'disable_tags');
                }
                break;
        }
    }

    _updateBadges(groupIds = this._state.joinedGroupIds) {
        if (groupIds && groupIds.length) {
            const client = MatrixClientPeg.get();
            const changedBadges = {};
            groupIds.forEach(groupId => {
                const rooms =
                    GroupStore.getGroupRooms(groupId)
                    .map(r => client.getRoom(r.roomId)) // to Room objects
                    .filter(r => r !== null && r !== undefined);   // filter out rooms we haven't joined from the group
                const badge = rooms && RoomNotifs.aggregateNotificationCount(rooms);
                changedBadges[groupId] = (badge && badge.count !== 0) ? badge : undefined;
            });
            const newBadges = Object.assign({}, this._state.badges, changedBadges);
            this._setState({badges: newBadges});
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
        const removedTags = new Set(this._state.removedTagsAccountData || []);


        const tagsToKeep = tags.filter(
            (t) => (t[0] !== '+' || groupIds.includes(t)) && !removedTags.has(t),
        );

        const groupIdsToAdd = groupIds.filter(
            (groupId) => !tags.includes(groupId) && !removedTags.has(groupId),
        );

        return tagsToKeep.concat(groupIdsToAdd);
    }

    getGroupBadge(groupId) {
        const badges = this._state.badges;
        return badges && badges[groupId];
    }

    getOrderedTags() {
        return this._state.orderedTags;
    }

    getRemovedTagsAccountData() {
        return this._state.removedTagsAccountData;
    }

    getStoreId() {
        // Generate a random ID to prevent this store from clobbering its
        // state with redundant remote echos.
        if (!this._id) this._id = Math.random().toString(16).slice(2, 10);
        return this._id;
    }

    getSelectedTags() {
        return this._state.selectedTags;
    }
}

if (global.singletonTagOrderStore === undefined) {
    global.singletonTagOrderStore = new TagOrderStore();
}
export default global.singletonTagOrderStore;
