export enum MediaPreviewValue {
    On = "on",
    Private = "private",
    Off = "off"
}

export interface MediaPreviewConfig extends Record<string, unknown> {
    media_previews: MediaPreviewValue,
    invite_avatars: MediaPreviewValue,
}