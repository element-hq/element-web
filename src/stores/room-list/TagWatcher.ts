/*
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

import { RoomListStoreClass } from "./RoomListStore";
import TagOrderStore from "../TagOrderStore";
import { CommunityFilterCondition } from "./filters/CommunityFilterCondition";
import { arrayDiff, arrayHasDiff } from "../../utils/arrays";

/**
 * Watches for changes in tags/groups to manage filters on the provided RoomListStore
 */
export class TagWatcher {
    // TODO: Support custom tags, somehow: https://github.com/vector-im/riot-web/issues/14091
    private filters = new Map<string, CommunityFilterCondition>();

    constructor(private store: RoomListStoreClass) {
        TagOrderStore.addListener(this.onTagsUpdated);
    }

    private onTagsUpdated = () => {
        const lastTags = Array.from(this.filters.keys());
        const newTags = TagOrderStore.getSelectedTags();

        if (arrayHasDiff(lastTags, newTags)) {
            // Selected tags changed, do some filtering

            if (!this.store.matrixClient) {
                console.warn("Tag update without an associated matrix client - ignoring");
                return;
            }

            const newFilters = new Map<string, CommunityFilterCondition>();

            // TODO: Support custom tags, somehow: https://github.com/vector-im/riot-web/issues/14091
            const filterableTags = newTags.filter(t => t.startsWith("+"));

            for (const tag of filterableTags) {
                const group = this.store.matrixClient.getGroup(tag);
                if (!group) {
                    console.warn(`Group selected with no group object available: ${tag}`);
                    continue;
                }

                newFilters.set(tag, new CommunityFilterCondition(group));
            }

            // Update the room list store's filters
            const diff = arrayDiff(lastTags, newTags);
            for (const tag of diff.added) {
                // TODO: Remove this check when custom tags are supported (as we shouldn't be losing filters)
                // Ref https://github.com/vector-im/riot-web/issues/14091
                const filter = newFilters.get(tag);
                if (!filter) continue;

                this.store.addFilter(filter);
            }
            for (const tag of diff.removed) {
                // TODO: Remove this check when custom tags are supported (as we shouldn't be losing filters)
                const filter = this.filters.get(tag);
                if (!filter) continue;

                this.store.removeFilter(filter);
            }

            // Destroy any and all old filter conditions to prevent resource leaks
            for (const filter of this.filters.values()) {
                filter.destroy();
            }

            this.filters = newFilters;
        }
    };
}
