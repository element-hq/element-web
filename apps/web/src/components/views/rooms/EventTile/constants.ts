/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { E2ePadlockIcon } from "./E2ePadlock";

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
    Normal = E2ePadlockIcon.Normal,
    Warning = E2ePadlockIcon.Warning,
    DecryptionFailure = E2ePadlockIcon.DecryptionFailure,
}
