/*
Copyright 2019 New Vector Ltd

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
 * Holds the current Platform object used by the code to do anything
 * specific to the platform we're running on (eg. web, electron)
 * Platforms are provided by the app layer.
 * This allows the app layer to set a Platform without necessarily
 * having to have a MatrixChat object
 */

import PlatformPeg from "./PlatformPeg";
import EventIndex from "./EventIndexing";
import MatrixClientPeg from "./MatrixClientPeg";

class EventIndexPeg {
    constructor() {
        this.index = null;
    }

    /**
     * Returns the current Event index object for the application. Can be null
     * if the platform doesn't support event indexing.
     */
    get() {
        return this.index;
    }

    /** Create a new EventIndex and initialize it if the platform supports it.
     * Returns true if an EventIndex was successfully initialized, false
     * otherwise.
     */
    async init() {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return false;

        let index = new EventIndex();

        const userId = MatrixClientPeg.get().getUserId();
        // TODO log errors here and return false if it errors out.
        await index.init(userId);
        this.index = index;

        return true
    }

    async stop() {
        if (this.index == null) return;
        index.stopCrawler();
    }

    async deleteEventIndex() {
        if (this.index == null) return;
        index.deleteEventIndex();
    }
}

if (!global.mxEventIndexPeg) {
    global.mxEventIndexPeg = new EventIndexPeg();
}
module.exports = global.mxEventIndexPeg;
