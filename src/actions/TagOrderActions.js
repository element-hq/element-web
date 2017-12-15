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
 * commit TagOrderStore.getOrderedTags() to account data and dispatch
 * actions to indicate the status of the request.
 *
 * @param {MatrixClient} matrixClient the matrix client to set the
 *                                    account data on.
 * @returns {function} an action thunk that will dispatch actions
 *                     indicating the status of the request.
 * @see asyncAction
 */
TagOrderActions.commitTagOrdering = function(matrixClient) {
    return asyncAction('TagOrderActions.commitTagOrdering', () => {
        // Only commit tags if the state is ready, i.e. not null
        const tags = TagOrderStore.getOrderedTags();
        if (!tags) {
            return;
        }

        Analytics.trackEvent('TagOrderActions', 'commitTagOrdering');
        return matrixClient.setAccountData('im.vector.web.tag_ordering', {tags});
    });
};

export default TagOrderActions;
