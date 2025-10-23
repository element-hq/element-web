/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "../models/Room";

/**
 * Provides some basic functionality of the Room List Store from element-web.
 * @public
 */
export interface RoomListStoreApi {
    /**
     * Get a flat list of sorted room from the RLS.
     */
    getRooms(): Room[];

    /**
     * Returns a promise that resolves when RLS is ready.
     */
    waitForReady(): Promise<void>;
}

/**
 * Provides access to certain stores from element-web.
 * @public
 */
export interface StoresApi {
    /**
     * Use this to access limited functionality of the RLS from element-web.
     */
    roomListStore: RoomListStoreApi;
}
