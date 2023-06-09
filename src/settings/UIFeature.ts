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
