/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/*
 * Object holding the global EventIndex object. Can only be initialized if the
 * platform supports event indexing.
 */

import PlatformPeg from "../PlatformPeg";
import EventIndex from "../indexing/EventIndex";
import SettingsStore from '../settings/SettingsStore';

class EventIndexPeg {
    constructor() {
        this.index = null;
    }

    /**
     * Create a new EventIndex and initialize it if the platform supports it.
     *
     * @return {Promise<bool>} A promise that will resolve to true if an
     * EventIndex was successfully initialized, false otherwise.
     */
    async init() {
        if (!SettingsStore.isFeatureEnabled("feature_event_indexing")) {
            return false;
        }

        const indexManager = PlatformPeg.get().getEventIndexingManager();
        if (!indexManager || await indexManager.supportsEventIndexing() !== true) {
            console.log("EventIndex: Platform doesn't support event indexing,",
                        "not initializing.");
            return false;
        }

        const index = new EventIndex();

        try {
            await index.init();
        } catch (e) {
            console.log("EventIndex: Error initializing the event index", e);
            return false;
        }

        this.index = index;

        return true;
    }

    /**
     * Get the current event index.
     *
     * @return {EventIndex} The current event index.
     */
    get() {
        return this.index;
    }

    stop() {
        if (this.index === null) return;
        this.index.stopCrawler();
    }

    /**
     * Unset our event store
     *
     * After a call to this the init() method will need to be called again.
     *
     * @return {Promise} A promise that will resolve once the event index is
     * closed.
     */
    async unset() {
        if (this.index === null) return;
        this.index.close();
        this.index = null;
    }

    /**
     * Delete our event indexer.
     *
     * After a call to this the init() method will need to be called again.
     *
     * @return {Promise} A promise that will resolve once the event index is
     * deleted.
     */
    async deleteEventIndex() {
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        if (indexManager !== null) {
            this.unset();
            console.log("EventIndex: Deleting event index.");
            await indexManager.deleteEventIndex();
        }
    }
}

if (!global.mxEventIndexPeg) {
    global.mxEventIndexPeg = new EventIndexPeg();
}
export default global.mxEventIndexPeg;
