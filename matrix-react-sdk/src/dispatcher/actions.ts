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
     * Open the user device settings. No additional payload information required.
     */
    ViewUserDeviceSettings = "view_user_device_settings",

    /**
     * Opens the room directory. No additional payload information required.
     */
    ViewRoomDirectory = "view_room_directory",

    /**
     * Fires when viewing room by room_alias fails to find room
     */
    ViewRoomError = "view_room_error",

    /**
     * Navigates to app home
     */
    ViewHomePage = "view_home_page",

    /**
     * Forces the theme to reload. No additional payload information required.
     */
    RecheckTheme = "recheck_theme",

    /**
     * Provide status information for an ongoing update check. Should be used with a CheckUpdatesPayload.
     */
    CheckUpdates = "check_updates",

    /**
     * Focuses the user's cursor to the send message composer. Should be used with a FocusComposerPayload.
     */
    FocusSendMessageComposer = "focus_send_message_composer",

    /**
     * Clear the  to the send message composer. Should be used with a FocusComposerPayload.
     */
    ClearAndFocusSendMessageComposer = "clear_focus_send_message_composer",

    /**
     * Focuses the user's cursor to the edit message composer. Should be used with a FocusComposerPayload.
     */
    FocusEditMessageComposer = "focus_edit_message_composer",

    /**
     * Focuses the user's cursor to the edit message composer or send message
     * composer based on the current edit state. Should be used with a FocusComposerPayload.
     */
    FocusAComposer = "focus_a_composer",

    /**
     * Opens the user menu (previously known as the top left menu). No additional payload information required.
     */
    ToggleUserMenu = "toggle_user_menu",

    /**
     * Toggles the Space panel. No additional payload information required.
     */
    ToggleSpacePanel = "toggle_space_panel",

    /**
     * Sets the apps root font size. Should be used with UpdateFontSizePayload
     */
    UpdateFontSize = "update_font_size",

    /**
     * Sets a system font. Should be used with UpdateSystemFontPayload
     */
    UpdateSystemFont = "update_system_font",

    /**
     * Changes room based on payload parameters. Should be used with JoinRoomPayload.
     */
    ViewRoom = "view_room",

    /**
     * Changes thread based on payload parameters. Should be used with ThreadPayload.
     */
    ViewThread = "view_thread",

    /**
     * Changes room based on room list order and payload parameters. Should be used with ViewRoomDeltaPayload.
     */
    ViewRoomDelta = "view_room_delta",

    /**
     * Opens the modal dial pad
     */
    OpenDialPad = "open_dial_pad",

    /**
     * Dial the phone number in the payload
     * payload: DialNumberPayload
     */
    DialNumber = "dial_number",

    /**
     * Fired when CallHandler has checked for PSTN protocol support
     * payload: none
     * XXX: Is an action the right thing for this?
     */
    PstnSupportUpdated = "pstn_support_updated",

    /**
     * Similar to PstnSupportUpdated, fired when CallHandler has checked for virtual room support
     * payload: none
     * XXX: Ditto
     */
    VirtualRoomSupportUpdated = "virtual_room_support_updated",

    /**
     * Fired when an upload has started. Should be used with UploadStartedPayload.
     */
    UploadStarted = "upload_started",

    /**
     * Fired when an upload makes progress. Should be used with UploadProgressPayload.
     */
    UploadProgress = "upload_progress",

    /**
     * Fired when an upload is completed. Should be used with UploadFinishedPayload.
     */
    UploadFinished = "upload_finished",

    /**
     * Fired when an upload fails. Should be used with UploadErrorPayload.
     */
    UploadFailed = "upload_failed",

    /**
     * Fired when an upload is cancelled by the user. Should be used with UploadCanceledPayload.
     */
    UploadCanceled = "upload_canceled",

    /**
     * Fired when requesting to join a room. Should be used with JoinRoomPayload.
     */
    JoinRoom = "join_room",

    /**
     * Fired when successfully joining a room. Should be used with a JoinRoomReadyPayload.
     */
    JoinRoomReady = "join_room_ready",

    /**
     * Fired when joining a room failed
     */
    JoinRoomError = "join_room_error",

    /**
     * Fired when starting to bulk redact messages from a user in a room.
     */
    BulkRedactStart = "bulk_redact_start",

    /**
     * Fired when done bulk redacting messages from a user in a room.
     */
    BulkRedactEnd = "bulk_redact_end",

    /**
     * Inserts content into the active composer. Should be used with ComposerInsertPayload.
     */
    ComposerInsert = "composer_insert",

    /**
     * Switches space. Should be used with SwitchSpacePayload.
     */
    SwitchSpace = "switch_space",

    /**
     * Signals to the visible space hierarchy that a change has occurred and that it should refresh.
     */
    UpdateSpaceHierarchy = "update_space_hierarchy",

    /**
     * Fires when a monitored setting is updated,
     * see SettingsStore::monitorSetting for more details.
     * Should be used with SettingUpdatedPayload.
     */
    SettingUpdated = "setting_updated",

    /**
     * Fires when a user starts to edit event (e.g. up arrow in compositor)
     */
    EditEvent = "edit_event",

    /**
     * The user accepted pseudonymous analytics (i.e. posthog) from the toast
     * Payload: none
     */
    PseudonymousAnalyticsAccept = "pseudonymous_analytics_accept",

    /**
     * The user rejected pseudonymous analytics (i.e. posthog) from the toast
     * Payload: none
     */
    PseudonymousAnalyticsReject = "pseudonymous_analytics_reject",

    /**
     * Fires after crypto is setup if key backup is not enabled
     * Used to trigger auto rageshakes when configured
     */
    ReportKeyBackupNotEnabled = "report_key_backup_not_enabled",

    /**
     * Dispatched after leave room or space is finished
     */
    AfterLeaveRoom = "after_leave_room",

    /**
     * Used to defer actions until after sync is complete
     * LifecycleStore will emit deferredAction payload after 'MatrixActions.sync'
     */
    DoAfterSyncPrepared = "do_after_sync_prepared",

    /**
     * Fired when clicking user name from group view
     */
    ViewStartChatOrReuse = "view_start_chat_or_reuse",

    /**
     * Fired when the user's active room changed, possibly from/to a non-room view.
     * Payload: ActiveRoomChangedPayload
     */
    ActiveRoomChanged = "active_room_changed",

    /**
     * Fired when the forward dialog needs to be opened.
     * Payload: OpenForwardDialogPayload
     */
    OpenForwardDialog = "open_forward_dialog",

    /**
     * Fired when the "report event" dialog needs to be opened.
     * Payload: OpenReportEventDialogPayload.
     */
    OpenReportEventDialog = "open_report_event_dialog",

    /**
     * Fired when something within the application has determined that a logout,
     * or logout-like behaviour, needs to happen. Specifically meant to target
     * storage deletion rather than calling the logout API.
     *
     * No payload.
     */
    TriggerLogout = "trigger_logout",

    /**
     * Opens the user's preferences for the given space. Used with a OpenSpacePreferencesPayload.
     */
    OpenSpacePreferences = "open_space_preferences",

    /**
     * Opens the settings for the given space. Used with a OpenSpaceSettingsPayload.
     */
    OpenSpaceSettings = "open_space_settings",

    /**
     * Opens the invite dialog. Used with a OpenInviteDialogPayload.
     */
    OpenInviteDialog = "open_invite_dialog",

    /**
     * Opens a dialog to add an existing object to a space. Used with a OpenAddExistingToSpaceDialogPayload.
     */
    OpenAddToExistingSpaceDialog = "open_add_to_existing_space_dialog",

    /**
     * Let components know that they should log any useful debugging information
     * because we're probably about to send bug report which includes all of the
     * logs. Fires with no payload.
     */
    DumpDebugLogs = "dump_debug_logs",

    /**
     * Show current room topic
     */
    ShowRoomTopic = "show_room_topic",

    /**
     * Fired when the client was logged out. No additional payload information required.
     */
    OnLoggedOut = "on_logged_out",

    /**
     * Fired when the client was logged in. No additional payload information required.
     */
    OnLoggedIn = "on_logged_in",

    /**
     * Overwrites the existing login with fresh session credentials. Use with a OverwriteLoginPayload.
     */
    OverwriteLogin = "overwrite_login",

    /**
     * Fired when the PlatformPeg gets a new platform set upon it, should only happen once per app load lifecycle.
     * Fires with the PlatformSetPayload.
     */
    PlatformSet = "platform_set",

    /**
     * Fired when we want to view a thread, either a new one or an existing one
     */
    ShowThread = "show_thread",
}
