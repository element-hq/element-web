/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Enum of UI components which can have their behaviour tweaked
 * @alpha
 */
export const enum UIComponent {
    /**
     * Components that lead to a user being invited.
     */
    InviteUsers = "UIComponent.sendInvites",

    /**
     * Components that lead to a room being created that aren't already
     * guarded by some other condition (ie: "only if you can edit this
     * space" is *not* guarded by this component, but "start DM" is).
     */
    CreateRooms = "UIComponent.roomCreation",

    /**
     * Components that lead to a Space being created that aren't already
     * guarded by some other condition (ie: "only if you can add subspaces"
     * is *not* guarded by this component, but "create new space" is).
     */
    CreateSpaces = "UIComponent.spaceCreation",

    /**
     * Components that lead to the public room directory.
     */
    ExploreRooms = "UIComponent.exploreRooms",

    /**
     * Components that lead to the user being able to easily add widgets
     * and integrations to the room, such as from the room information card.
     */
    AddIntegrations = "UIComponent.addIntegrations",

    /**
     * Component that lead to the user being able to search, dial, explore rooms
     */
    FilterContainer = "UIComponent.filterContainer",

    /**
     * Components that lead the user to room options menu.
     */
    RoomOptionsMenu = "UIComponent.roomOptionsMenu",
}

/**
 * API for customising Element Web's components
 * @alpha Subject to change.
 */
export interface CustomisationsApi {
    /**
     * Method to register a callback which can affect whether a given component is drawn or not.
     * @param fn - the callback, if it returns true the component will be rendered, if false it will not be.
     *   If undefined will defer to next callback, ultimately falling through to `true` if none return false.
     */
    registerShouldShowComponent(fn: (this: void, component: UIComponent) => boolean | void): void;
}
