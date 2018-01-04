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

import GroupStore from './GroupStore';

class GroupStoreCache {
    constructor() {
        this.groupStore = null;
    }

    getGroupStore(groupId) {
        if (!this.groupStore || this.groupStore.groupId !== groupId) {
            // This effectively throws away the reference to any previous GroupStore,
            // allowing it to be GCd once the components referencing it have stopped
            // referencing it.
            this.groupStore = new GroupStore(groupId);
        }
        return this.groupStore;
    }
}

if (global.singletonGroupStoreCache === undefined) {
    global.singletonGroupStoreCache = new GroupStoreCache();
}
export default global.singletonGroupStoreCache;
