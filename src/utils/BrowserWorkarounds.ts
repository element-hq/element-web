/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MouseEvent } from "react";

export function chromeFileInputFix(event: MouseEvent<HTMLInputElement>): void {
    // Workaround for Chromium Bug
    // Chrome does not fire onChange events if the same file is selected twice
    // Only required on Chromium-based browsers (Electron, Chrome, Edge, Opera, Vivaldi, etc)
    event.currentTarget.value = "";
}
