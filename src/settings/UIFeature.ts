/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// see settings.md for documentation on conventions
export const enum UIFeature {
    AdvancedEncryption = "UIFeature.advancedEncryption",
    URLPreviews = "UIFeature.urlPreviews",
    Widgets = "UIFeature.widgets",
    LocationSharing = "UIFeature.locationSharing",
    Voip = "UIFeature.voip",
    Feedback = "UIFeature.feedback",
    Registration = "UIFeature.registration",
    PasswordReset = "UIFeature.passwordReset",
    Deactivate = "UIFeature.deactivate",
    ShareQRCode = "UIFeature.shareQrCode",
    ShareSocial = "UIFeature.shareSocial",
    IdentityServer = "UIFeature.identityServer",
    ThirdPartyID = "UIFeature.thirdPartyId",
    AdvancedSettings = "UIFeature.advancedSettings",
    RoomHistorySettings = "UIFeature.roomHistorySettings",
    TimelineEnableRelativeDates = "UIFeature.timelineEnableRelativeDates",
    BulkUnverifiedSessionsReminder = "UIFeature.BulkUnverifiedSessionsReminder",
    ShowCreateSpaceButton = "UIFeature.showCreateSpaceButton",
    ShowLeaveSpaceInContextMenu = "UIFeature.showLeaveSpaceInContextMenu",
    ShowMembersListForSpaces = "UIFeature.showMembersListForSpaces",
    ShowPlusMenuForMetaSpace = "UIFeature.showPlusMenuForMetaSpace",
    ShowStartChatPlusMenuForMetaSpace = "UIFeature.showStartChatPlusMenuForMetaSpace",
    ShowAddRoomPlusMenuForMetaSpace = "UIFeature.showAddRoomPlusMenuForMetaSpace",
    ShowExploreRoomsButton = "UIFeature.showExploreRoomsButton",
    ShowAddWidgetsInRoomInfo = "UIFeature.showAddWidgetsInRoomInfo",
    AddExistingRoomToSpace = "UIFeature.addExistingRoomToSpace",
    ShowAddMoreButtonForSpaces = "UIFeature.showAddMoreButtonForSpaces",
    AddSubSpace = "UIFeature.addSubSpace",
    AddSpace = "UIFeature.addSpace",
    ShowStickersButtonSetting = "UIFeature.showStickersButtonSetting",
    InsertTrailingColonSetting = "UIFeature.insertTrailingColonSetting",
    ShowJoinLeavesSetting = "UIFeature.showJoinLeavesSetting",
    ShowChatEffectSetting = "UIFeature.showChatEffectSetting",
    UnverifiedSessionsToast = "UIFeature.unverifiedSessionsToast",
    SearchShortcutPreferences = "UIFeature.searchShortcutPreferences",
    HomePageButtons = "UIFeature.homePageButtons",
    UserInfoVerifyDevice = "UIFeature.userInfoVerifyDevice",
    UserInfoShareLinkToUserButton = "UIFeature.userInfoShareLinkToUserButton",
    UserInfoRedactButton = "UIFeature.userInfoRedactButton",
    RoomListExplorePublicRooms = "UIFeature.roomListExplorePublicRooms",
    CreateRoomE2eeSection = "UIFeature.createRoomE2eeSection",
    CreateRoomShowJoinRuleDropdown = "UIFeature.createRoomShowJoinRuleDropdown",
    CreateRoomShowAdvancedSettings = "UIFeature.createRoomShowAdvancedSettings",
    RoomSummaryFilesOption = "UIFeature.roomSummaryFilesOption",
    RoomSummaryCopyLink = "UIFeature.roomSummaryCopyLink",
    NewRoomIntroInviteThisRoom = "UIFeature.newRoomIntroInviteThisRoom",
    EmailAddressShowRemoveButton = "UIFeature.emailAddressShowRemoveButton",
    EmailAddressShowAddButton = "UIFeature.emailAddressShowAddButton",
    PhoneNumerShowRemoveButton = "UIFeature.phoneNumerShowRemoveButton",
    PhoneNumerShowAddButton = "UIFeature.phoneNumerShowAddButton",
    RoomSettingsAlias = "UIFeature.roomSettingsAlias",
    UserSettingsExternalAccount = "UIFeature.userSettingsExternalAccount",
    UserSettingsChangePassword = "UIFeature.userSettingsChangePassword",
    UserSettingsSetIdServer = "UIFeature.userSettingsSetIdServer",
    UserSettingsDiscovery = "UIFeature.userSettingsDiscovery",
    UserSettingsIntegrationManager = "UIFeature.userSettingsIntegrationManager",
    UserSettingsResetCrossSigning = "UIFeature.userSettingsResetCrossSigning",
    UserSettingsDeleteBackup = "UIFeature.userSettingsDeleteBackup",
    UserSettingsResetBackup = "UIFeature.userSettingsResetBackup",
    SetupEncryptionResetButton = "UIFeature.setupEncryptionResetButton",
    AccountSendAccountEvent = "UIFeature.accountSendAccountEvent",
    AccountSendRoomEvent = "UIFeature.accountSendRoomEvent",
    EnableLoginPage = "UIFeature.enableLoginPage",
    EnableNewRoomIntro = "UIFeature.enableNewRoomIntro",
    EnableRoomDevTools = "UIFeature.enableRoomDevTools",
    WidgetContextDeleteButton = "UIFeature.widgetContextDeleteButton",
    ExportDefaultSizeLimit = "UIFeature.exportDefaultSizeLimit",
    AllExportTypes = "UIFeature.allExportTypes",
    ExportAttatchmentsDefaultOff = "UIFeature.exportAttatchmentsDefaultOff",
    RoomSettingsSecurity = "UIFeature.roomSettingsSecurity",
    RoomPreviewRejectIgnoreButton = "UIFeature.roomPreviewRejectIgnoreButton",
    BaseToolActionButton = "UIFeature.baseToolActionButton",
    NetworkOptions = "UIFeature.networkOptions",
    SearchWarnings = "UIFeature.searchWarnings",
    PowerSelectorCustomValue = "UIFeature.powerSelectorCustomValue",
    CustomThemePanel = "UIFeature.customThemePanel",
    VideoMirrorLocalVideo = "UIFeature.videoMirrorLocalVideo",
    VideoConnectionSettings = "UIFeature.videoConnectionSettings",
    SpotlightDialogShowOtherSearches = "UIFeature.spotlightDialogShowOtherSearches",
    MultipleCallsInRoom = "UIFeature.multipleCallsInRoom",
    ShowSpaceLandingPageDetails = "UIFeature.showSpaceLandingPageDetails",
    ShowSendMessageToUserLink = "UIFeature.showSendMessageToUserLink",
    SendInviteLinkPrompt = "UIFeature.sendInviteLinkPrompt",
    HelpShowMatrixDisclosurePolicyAndLinks = "UIFeature.helpShowMatrixDisclosurePolicyAndLinks",
    ShowInviteToSpaceFromPeoplePlus = "UIFeature.showInviteToSpaceFromPeoplePlus",
    SettingShowMessageSearch = "UIFeature.settingShowMessageSearch",
    ShowRoomMembersInSuggestions = "UIFeature.showRoomMembersInSuggestions",
    ShowRecentsInSuggestions = "UIFeature.showRecentsInSuggestions",
    AllowDirectUserInvite = "UIFeature.allowDirectUserInvite",
    SearchInAllRooms = "UIFeature.searchInAllRooms",
    LeaveSpaceButton = "UIFeature.leaveSpaceButton",
}

export enum UIComponent {
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
