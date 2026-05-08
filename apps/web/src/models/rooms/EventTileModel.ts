/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/** Controls how sender information is presented for an event tile. */
export enum SenderMode {
    /** Omits sender information entirely. */
    Hidden = "hidden",
    /** Shows sender information using the standard timeline presentation. */
    Default = "default",
    /** Shows sender information in the compact composer insertion style. */
    ComposerInsert = "composerInsert",
    /** Shows sender information in a tooltip-oriented presentation. */
    Tooltip = "tooltip",
}

/** Controls which thread metadata is shown alongside an event tile. */
export enum ThreadInfoMode {
    /** Hides thread metadata. */
    None = "none",
    /** Shows the standard thread summary UI. */
    Summary = "summary",
    /** Shows the compact search-result thread label as a link. */
    SearchLink = "searchLink",
    /** Shows the compact search-result thread label without a link. */
    SearchText = "searchText",
}

/** Controls whether the thread summary and toolbar are rendered below the tile. */
export enum ThreadPanelMode {
    /** Hides all thread panel UI. */
    None = "none",
    /** Shows only the thread toolbar. */
    Toolbar = "toolbar",
    /** Shows only the thread summary. */
    Summary = "summary",
    /** Shows both the thread summary and the thread toolbar. */
    SummaryWithToolbar = "summaryWithToolbar",
}

/** Defines the primary click action for the tile. */
export enum ClickMode {
    /** Disables tile click behavior. */
    None = "none",
    /** Opens the room that contains the event. */
    ViewRoom = "viewRoom",
    /** Opens the event thread. */
    ShowThread = "showThread",
}

/** Describes how the event body was rendered. */
export enum EventTileRenderMode {
    /** Rendered with the event's normal renderer. */
    Rendered = "rendered",
    /** Rendered with a generic fallback because no dedicated renderer was available. */
    MissingRendererFallback = "missingRendererFallback",
}

/** Controls which encryption status indicator is shown. */
export enum EncryptionIndicatorMode {
    /** Hides the encryption indicator. */
    None = "none",
    /** Shows the normal encryption indicator. */
    Normal = "normal",
    /** Shows a warning indicator for encryption-related issues. */
    Warning = "warning",
    /** Shows a decryption failure indicator. */
    DecryptionFailure = "decryptionFailure",
}

/** Controls how the tile timestamp is presented. */
export enum TimestampDisplayMode {
    /** Hides the timestamp. */
    Hidden = "hidden",
    /** Shows the timestamp as plain text. */
    Plain = "plain",
    /** Shows the timestamp as a permalink. */
    Linked = "linked",
    /** Reserves timestamp space without rendering the actual time, used for IRC alignment. */
    Placeholder = "placeholder",
}

/** Controls whether timestamps use absolute or relative formatting. */
export enum TimestampFormatMode {
    /** Uses an absolute date/time representation. */
    Absolute = "absolute",
    /** Uses a relative time representation. */
    Relative = "relative",
}

/** Controls which padlock badge is shown for room type or origin. */
export enum PadlockMode {
    /** Hides the padlock badge. */
    None = "none",
    /** Shows the group room padlock badge. */
    Group = "group",
    /** Shows the IRC padlock badge. */
    Irc = "irc",
}

/** Defines the avatar size used by the tile. */
export enum AvatarSize {
    /** Hides the avatar. */
    None = "none",
    /** Uses the extra-small avatar size. */
    XSmall = "xsmall",
    /** Uses the small avatar size. */
    Small = "small",
    /** Uses the medium avatar size. */
    Medium = "medium",
    /** Uses the large avatar size. */
    Large = "large",
    /** Uses the extra-large avatar size. */
    XLarge = "xlarge",
}

/** Selects which entity the avatar should represent. */
export enum AvatarSubject {
    /** Does not render an avatar subject. */
    None = "none",
    /** Uses the event sender as the avatar subject. */
    Sender = "sender",
    /** Uses the event target as the avatar subject. */
    Target = "target",
}
