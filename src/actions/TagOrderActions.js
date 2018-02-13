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

import Analytics from '../Analytics';
import { asyncAction } from './actionCreators';
import TagOrderStore from '../stores/TagOrderStore';

const TagOrderActions = {};

/**
 * Creates an action thunk that will do an asynchronous request to
 * move a tag in TagOrderStore to destinationIx.
 *
 * @param {MatrixClient} matrixClient the matrix client to set the
 *                                    account data on.
 * @param {string} tag the tag to move.
 * @param {number} destinationIx the new position of the tag.
 * @returns {function} an action thunk that will dispatch actions
 *                     indicating the status of the request.
 * @see asyncAction
 */
TagOrderActions.moveTag = function(matrixClient, tag, destinationIx) {
    // Only commit tags if the state is ready, i.e. not null
    let tags = TagOrderStore.getOrderedTags();
    if (!tags) {
        return;
    }

    tags = tags.filter((t) => t !== tag);
    tags = [...tags.slice(0, destinationIx), tag, ...tags.slice(destinationIx)];

    const storeId = TagOrderStore.getStoreId();

    return asyncAction('TagOrderActions.moveTag', () => {
        Analytics.trackEvent('TagOrderActions', 'commitTagOrdering');
        return matrixClient.setAccountData(
            'im.vector.web.tag_ordering',
            {tags, _storeId: storeId},
        );
    }, () => {
        // For an optimistic update
        return {tags};
    });
};

/**
 * Creates an action thunk that will do an asynchronous request to
 * label a tag as removed in im.vector.web.tag_ordering account data.
 *
 * The reason this is implemented with new state `removedTags` is that
 * we incrementally and initially populate `tags` with groups that
 * have been joined. If we remove a group from `tags`, it will just
 * get added (as it looks like a group we've recently joined).
 *
 * NB: If we ever support adding of tags (which is planned), we should
 * take special care to remove the tag from `removedTags` when we add
 * it.
 *
 * @param {MatrixClient} matrixClient the matrix client to set the
 *                                    account data on.
 * @param {string} tag the tag to remove.
 * @returns {function} an action thunk that will dispatch actions
 *                     indicating the status of the request.
 * @see asyncAction
 */
TagOrderActions.removeTag = function(matrixClient, tag) {
    // Don't change tags, just removedTags
    const tags = TagOrderStore.getOrderedTags();
    const removedTags = TagOrderStore.getRemovedTagsAccountData() || [];

    if (removedTags.includes(tag)) {
        // Return a thunk that doesn't do anything, we don't even need
        // an asynchronous action here, the tag is already removed.
        return () => {};
    }

    removedTags.push(tag);

    const storeId = TagOrderStore.getStoreId();

    return asyncAction('TagOrderActions.removeTag', () => {
        Analytics.trackEvent('TagOrderActions', 'removeTag');
        return matrixClient.setAccountData(
            'im.vector.web.tag_ordering',
            {tags, removedTags, _storeId: storeId},
        );
    }, () => {
        // For an optimistic update
        return {removedTags};
    });
};

export default TagOrderActions;
