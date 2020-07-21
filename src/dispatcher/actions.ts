/*
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

// Dispatcher actions also extend into any arbitrary string, so support that.
export type DispatcherAction = Action | string;

export enum Action {
    // TODO: Populate with actual actions
    // This is lazily generated as it also includes fixing a bunch of references. Work
    // that we don't really want to take on in a giant chunk. We should always define
    // new actions here, and ideally when we touch existing ones we take some time to
    // define them correctly.

    // When defining a new action, please use lower_scored_case with an optional class
    // name prefix. For example, `RoomListStore.view_room` or `view_user_settings`.
    // New definitions should also receive an accompanying interface in the payloads
    // directory.

    /**
     * View a user's profile. Should be used with a ViewUserPayload.
     */
    ViewUser = "view_user",

    /**
     * Open the user settings. No additional payload information required.
     * Optionally can include an OpenToTabPayload.
     */
    ViewUserSettings = "view_user_settings",

    /**
     * Opens the room directory. No additional payload information required.
     */
    ViewRoomDirectory = "view_room_directory",

    /**
     * Forces the theme to reload. No additional payload information required.
     */
    RecheckTheme = "recheck_theme",

    /**
     * Provide status information for an ongoing update check. Should be used with a CheckUpdatesPayload.
     */
    CheckUpdates = "check_updates",

    /**
     * Focuses the user's cursor to the composer. No additional payload information required.
     */
    FocusComposer = "focus_composer",

    /**
     * Opens the user menu (previously known as the top left menu). No additional payload information required.
     */
    ToggleUserMenu = "toggle_user_menu",

    /**
     * Sets the apps root font size. Should be used with UpdateFontSizePayload
     */
    UpdateFontSize = "update_font_size",

    /**
     * Sets a system font. Should be used with UpdateSystemFontPayload
     */
    UpdateSystemFont = "update_system_font",

    /**
     * Changes room based on room list order and payload parameters. Should be used with ViewRoomDeltaPayload.
     */
    ViewRoomDelta = "view_room_delta",
}
