/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "jitsi-meet";

declare module "jitsi-meet" {
    interface ExternalAPIEventCallbacks {
        errorOccurred: (e: { error: Error & { isFatal?: boolean } }) => void;
    }

    interface JitsiMeetExternalAPI {
        executeCommand(command: "setTileView", value: boolean): void;
    }
}

export as namespace Jitsi;
