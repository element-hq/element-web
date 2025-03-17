/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type BasePlatform from "./BasePlatform";
import defaultDispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import { type PlatformSetPayload } from "./dispatcher/payloads/PlatformSetPayload";

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
