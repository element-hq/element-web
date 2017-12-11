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

import Analytics from '../Analytics';
import { createPromiseActionCreator } from './actionCreators';
import TagOrderStore from '../stores/TagOrderStore';

const TagOrderActions = {};

TagOrderActions.commitTagOrdering = createPromiseActionCreator(
    'TagOrderActions.commitTagOrdering',
    (matrixClient) => {
        // Only commit tags if the state is ready, i.e. not null
        const tags = TagOrderStore.getOrderedTags();
        if (!tags) {
            return;
        }

        Analytics.trackEvent('TagOrderActions', 'commitTagOrdering');
        return matrixClient.setAccountData('im.vector.web.tag_ordering', {tags});
    },
);

export default TagOrderActions;
