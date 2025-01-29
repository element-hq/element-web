/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The types here suck but these customisations are deprecated and will be removed soon.
 */

export interface AliasCustomisations {
    // E.g. prefer one of the aliases over another
    getDisplayAliasForAliasSet?(canonicalAlias: string | null, altAliases: string[]): string | null;
}

export interface ChatExportCustomisations<ExportFormat, ExportType> {
    /**
     * Force parameters in room chat export fields returned here are forced
     * and not allowed to be edited in the chat export form
     */
    getForceChatExportParameters(): {
        format?: ExportFormat;
        range?: ExportType;
        // must be < 10**8
        // only used when range is 'LastNMessages'
        // default is 100
        numberOfMessages?: number;
        includeAttachments?: boolean;
        // maximum size of exported archive
        // must be > 0 and < 8000
        sizeMb?: number;
    };
}

export interface ComponentVisibilityCustomisations {
    /**
     * Determines whether or not the active MatrixClient user should be able to use
     * the given UI component. If shown, the user might still not be able to use the
     * component depending on their contextual permissions. For example, invite options
     * might be shown to the user but they won't have permission to invite users to
     * the current room: the button will appear disabled.
     * @param {UIComponent} component The component to check visibility for.
     * @returns {boolean} True (default) if the user is able to see the component, false
     * otherwise.
     */
    shouldShowComponent?(
        component:
            | "UIComponent.sendInvites"
            | "UIComponent.roomCreation"
            | "UIComponent.spaceCreation"
            | "UIComponent.exploreRooms"
            | "UIComponent.addIntegrations"
            | "UIComponent.filterContainer"
            | "UIComponent.roomOptionsMenu",
    ): boolean;
}

export interface DirectoryCustomisations {
    requireCanonicalAliasAccessToPublish?(): boolean;
}

export interface LifecycleCustomisations {
    onLoggedOutAndStorageCleared?(): void;
}

export interface Media {
    readonly isEncrypted: boolean;
    readonly srcMxc: string;
    readonly thumbnailMxc: string | null | undefined;
    readonly hasThumbnail: boolean;
    readonly srcHttp: string | null;
    readonly thumbnailHttp: string | null;
    getThumbnailHttp(width: number, height: number, mode?: "scale" | "crop"): string | null;
    getThumbnailOfSourceHttp(width: number, height: number, mode?: "scale" | "crop"): string | null;
    getSquareThumbnailHttp(dim: number): string | null;
    downloadSource(): Promise<Response>;
}

export interface MediaContructable<PreparedMedia> {
    new (prepared: PreparedMedia): Media;
}

export interface MediaCustomisations<Content, Client, PreparedMedia> {
    readonly Media: MediaContructable<PreparedMedia>;
    mediaFromContent(content: Content, client?: Client): Media;
    mediaFromMxc(mxc?: string, client?: Client): Media;
}

export interface RoomListCustomisations<Room> {
    /**
     * Determines if a room is visible in the room list or not. By default,
     * all rooms are visible. Where special handling is performed by Element,
     * those rooms will not be able to override their visibility in the room
     * list - Element will make the decision without calling this function.
     *
     * This function should be as fast as possible to avoid slowing down the
     * client.
     * @param {Room} room The room to check the visibility of.
     * @returns {boolean} True if the room should be visible, false otherwise.
     */
    isRoomVisible?(room: Room): boolean;
}

export interface UserIdentifierCustomisations {
    /**
     * Customise display of the user identifier
     * hide userId for guests, display 3pid
     *
     * Set withDisplayName to true when user identifier will be displayed alongside user name
     */
    getDisplayUserIdentifier(userId: string, opts: { roomId?: string; withDisplayName?: boolean }): string | null;
}

export interface WidgetPermissionsCustomisations<Widget, Capability> {
    /**
     * Approves the widget for capabilities that it requested, if any can be
     * approved. Typically this will be used to give certain widgets capabilities
     * without having to prompt the user to approve them. This cannot reject
     * capabilities that Element will be automatically granting, such as the
     * ability for Jitsi widgets to stay on screen - those will be approved
     * regardless.
     * @param {Widget} widget The widget to approve capabilities for.
     * @param {Set<Capability>} requestedCapabilities The capabilities the widget requested.
     * @returns {Set<Capability>} Resolves to the capabilities that are approved for use
     * by the widget. If none are approved, this should return an empty Set.
     */
    preapproveCapabilities?(widget: Widget, requestedCapabilities: Set<Capability>): Promise<Set<Capability>>;
}

export interface WidgetVariablesCustomisations {
    /**
     * Provides a partial set of the variables needed to render any widget. If
     * variables are missing or not provided then they will be filled with the
     * application-determined defaults.
     *
     * This will not be called until after isReady() resolves.
     * @returns The variables.
     */
    provideVariables?(): {
        currentUserId: string;
        userDisplayName?: string;
        userHttpAvatarUrl?: string;
        clientId?: string;
        clientTheme?: string;
        clientLanguage?: string;
        deviceId?: string;
        baseUrl?: string;
    };
    /**
     * Resolves to whether or not the customisation point is ready for variables
     * to be provided. This will block widgets being rendered.
     * If not provided, the app will assume that the customisation is always ready.
     * @returns {Promise<boolean>} Resolves when ready.
     */
    isReady?(): Promise<void>;
}

export type LegacyCustomisations<T extends object> = (customisations: T) => void;

export interface LegacyCustomisationsApiExtension {
    /**
     * @deprecated
     */
    readonly _registerLegacyAliasCustomisations: LegacyCustomisations<AliasCustomisations>;
    /**
     * @deprecated
     */
    readonly _registerLegacyChatExportCustomisations: LegacyCustomisations<ChatExportCustomisations<never, never>>;
    /**
     * @deprecated
     */
    readonly _registerLegacyComponentVisibilityCustomisations: LegacyCustomisations<ComponentVisibilityCustomisations>;
    /**
     * @deprecated
     */
    readonly _registerLegacyDirectoryCustomisations: LegacyCustomisations<DirectoryCustomisations>;
    /**
     * @deprecated
     */
    readonly _registerLegacyLifecycleCustomisations: LegacyCustomisations<LifecycleCustomisations>;
    /**
     * @deprecated
     */
    readonly _registerLegacyMediaCustomisations: LegacyCustomisations<MediaCustomisations<never, never, never>>;
    /**
     * @deprecated
     */
    readonly _registerLegacyRoomListCustomisations: LegacyCustomisations<RoomListCustomisations<never>>;
    /**
     * @deprecated
     */
    readonly _registerLegacyUserIdentifierCustomisations: LegacyCustomisations<UserIdentifierCustomisations>;
    /**
     * @deprecated
     */
    readonly _registerLegacyWidgetPermissionsCustomisations: LegacyCustomisations<
        WidgetPermissionsCustomisations<never, never>
    >;
    /**
     * @deprecated
     */
    readonly _registerLegacyWidgetVariablesCustomisations: LegacyCustomisations<WidgetVariablesCustomisations>;
}
