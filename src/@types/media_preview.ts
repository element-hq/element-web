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
