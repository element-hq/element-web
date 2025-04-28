/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum MediaPreviewValue {
    /**
     * Media previews should be enabled.
     */
    On = "on",
    /**
     * Media previews should only be enabled for rooms with non-public join rules.
     */
    Private = "private",
    /**
     * Media previews should be disabled.
     */
    Off = "off",
}

export const MEDIA_PREVIEW_ACCOUNT_DATA_TYPE = "io.element.msc4278.media_preview_config";
export interface MediaPreviewConfig extends Record<string, unknown> {
    /**
     * Media preview setting for thumbnails of media in rooms.
     */
    media_previews: MediaPreviewValue;
    /**
     * Media preview settings for avatars of rooms we have been invited to.
     */
    invite_avatars: MediaPreviewValue.On | MediaPreviewValue.Off;
}
