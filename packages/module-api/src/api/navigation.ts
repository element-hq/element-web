/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX } from "react";

/**
 * A function called to render a component when a user navigates to the corresponding
 * location. Currently renders alongside just the SpacePanel.
 * @alpha
 */
export type LocationRenderFunction = () => JSX.Element;

/**
 * The options available for changing the open behaviour.
 * @public
 */
export interface OpenRoomOptions {
    /**
     * The list of servers to join via.
     */
    viaServers?: string[];

    /**
     * Whether to automatically join the room if we are not already in it.
     */
    autoJoin?: boolean;
}

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

    /**
     * Register a renderer for a given location path.
     * @param path - The location path to register the renderer for.
     * @param renderer - The function that will render the component for the location.
     * @alpha
     */
    registerLocationRenderer(path: string, renderer: LocationRenderFunction): void;

    /**
     * Open a room in element-web.
     * @param roomIdOrAlias - id/alias of the room to open
     * @param opts - Options to control the open action, see {@link OpenRoomOptions}
     */
    openRoom(roomIdOrAlias: string, opts?: OpenRoomOptions): void;
}
