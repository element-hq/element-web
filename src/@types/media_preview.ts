/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum MediaPreviewValue {
    On = "on",
    Private = "private",
    Off = "off",
}

export const MEDIA_PREVIEW_ACCOUNT_DATA_TYPE = "io.element.msc4278.media_preview_config";
export interface MediaPreviewConfig extends Record<string, unknown> {
    media_previews: MediaPreviewValue;
    invite_avatars: MediaPreviewValue;
}
