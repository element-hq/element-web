/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JSX } from "react";

export type LocationRenderFunction = () => JSX.Element;

/**
 * API methods to navigate the application.
 * @public
 */
export interface NavigationApi {
    /**
     * Navigate to a permalink, optionally causing a join if the user is not already a member of the room/space.
     * @param link - The permalink to navigate to, e.g. `https://matrix.to/#/!roomId:example.com`.
     * @param join - If true, the user will be made to attempt to join the room/space if they are not already a member.
     */
    toMatrixToLink(link: string, join?: boolean): Promise<void>;

    registerLocationRenderer(path: string, renderer: LocationRenderFunction): void;
}
