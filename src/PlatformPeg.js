/*
Copyright 2016 OpenMarket Ltd

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
class PlatformPeg {
    constructor() {
        this.platform = null;
    }

    /**
     * Returns the current Platform object for the application.
     * This should be an instance of a class extending BasePlatform.
     */
    get() {
        return this.platform;
    }

    /**
     * Sets the current platform handler object to use for the
     * application.
     * This should be an instance of a class extending BasePlatform.
     */
    set(plaf) {
        this.platform = plaf;
    }
}

if (!global.mxPlatformPeg) {
    global.mxPlatformPeg = new PlatformPeg();
}
module.exports = global.mxPlatformPeg;
