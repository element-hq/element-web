/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Watchable } from "./watchable.ts";

/**
 * The profile of the user currently logged in.
 * @public
 */
export interface Profile {
    /**
     * Indicates whether the user is a guest user.
     */
    isGuest?: boolean;
    /**
     * The user ID of the logged-in user, if undefined then no user is logged in.
     */
    userId?: string;
    /**
     * The device ID of this client, if undefined then no user is logged in.
     */
    deviceId?: string;
    /**
     * The display name of the logged-in user.
     */
    displayName?: string;
    /**
     * The base API URL of the homeserver the user is logged into.
     */
    homeserverUrl?: string;
}

/**
 * API extensions for modules to access the profile of the logged-in user.
 * @public
 */
export interface ProfileApiExtension {
    /**
     * The profile of the user currently logged in.
     */
    readonly profile: Watchable<Profile>;
}
