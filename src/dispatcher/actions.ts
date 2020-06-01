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
     */
    ViewUserSettings = "view_user_settings",

    /**
     * Sets the current tooltip. Should be use with ViewTooltipPayload.
     */
    ViewTooltip = "view_tooltip",

    /**
     * Forces the theme to reload. No additional payload information required.
     */
    RecheckTheme = "recheck_theme",

    /**
     * Provide status information for an ongoing update check. Should be used with a CheckUpdatesPayload.
     */
    CheckUpdates = "check_updates",
}
