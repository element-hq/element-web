/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum SenderMode {
    Hidden = "hidden",
    Default = "default",
    ComposerInsert = "composerInsert",
    Tooltip = "tooltip",
}

export enum ThreadInfoMode {
    None = "none",
    Summary = "summary",
    SearchLink = "searchLink",
    SearchText = "searchText",
}

export enum ClickMode {
    None = "none",
    ViewRoom = "viewRoom",
    ShowThread = "showThread",
}

export enum EncryptionIndicatorMode {
    None = "none",
    Normal = "normal",
    Warning = "warning",
    DecryptionFailure = "decryptionFailure",
}

export enum TimestampDisplayMode {
    Hidden = "hidden",
    Plain = "plain",
    Linked = "linked",
    Placeholder = "placeholder",
}

export enum TimestampFormatMode {
    Absolute = "absolute",
    Relative = "relative",
}

export enum PadlockMode {
    None = "none",
    Group = "group",
    Irc = "irc",
}
