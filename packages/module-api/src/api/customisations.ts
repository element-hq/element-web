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
     * space" is *not* guarded by this component, but "new room" is).
     * DM creation is guarded separately by {@link UIComponent.CreateDM}.
     */
    CreateRooms = "UIComponent.roomCreation",

    /**
     * Components that lead to a direct message being created, such as "Start chat".
     * Before this existed, these were guarded by {@link UIComponent.CreateRooms}: modules
     * hiding room creation that also want to hide DM creation must now hide this as well.
     */
    CreateDM = "UIComponent.dmCreation",

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

    /**
     * Components that let the user make a room or space public, either when creating it or
     * by changing an existing one. Hiding this is equivalent to setting both
     * `UIFeature.allowCreatingPublicRooms` and `UIFeature.allowCreatingPublicSpaces` to false.
     */
    PublicRooms = "UIComponent.publicRooms",

    /**
     * Release announcements highlighting new features.
     */
    ReleaseAnnouncements = "UIComponent.releaseAnnouncements",
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
