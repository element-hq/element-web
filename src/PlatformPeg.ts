/*
Copyright 2016 OpenMarket Ltd
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

import BasePlatform from "./BasePlatform";
import defaultDispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import { PlatformSetPayload } from "./dispatcher/payloads/PlatformSetPayload";

/*
 * Holds the current instance of the `Platform` to use across the codebase.
 * Looking for an `Platform`? Just look for the `PlatformPeg` on the peg board.
 * "Peg" is the literal meaning of something you hang something on. So you'll
 * find a `Platform` hanging on the `PlatformPeg`.
 *
 * Used by the code to do anything specific to the platform we're running on
 * (eg. web, electron). Platforms are provided by the app layer. This allows the
 * app layer to set a Platform without necessarily having to have a MatrixChat
 * object.
 */
export class PlatformPeg {
    private platform: BasePlatform | null = null;

    /**
     * Returns the current Platform object for the application.
     * This should be an instance of a class extending BasePlatform.
     */
    public get(): BasePlatform | null {
        return this.platform;
    }

    /**
     * Sets the current platform handler object to use for the application.
     * @param {BasePlatform} platform an instance of a class extending BasePlatform.
     */
    public set(platform: BasePlatform): void {
        this.platform = platform;
        defaultDispatcher.dispatch<PlatformSetPayload>({
            action: Action.PlatformSet,
            platform,
        });
    }
}

if (!window.mxPlatformPeg) {
    window.mxPlatformPeg = new PlatformPeg();
}
export default window.mxPlatformPeg;
