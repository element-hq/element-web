/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { E2eMessageSharedIcon } from "./E2eMessageSharedIcon";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";

export function EventTileE2ePadlock({
    icon,
    title,
    sharedUserId,
    roomId,
}: {
    icon: "none" | "normal" | "warning" | "decryptionFailure";
    title?: string;
    sharedUserId?: string;
    roomId?: string;
}): JSX.Element | null {
    if (sharedUserId && roomId) {
        return <E2eMessageSharedIcon keyForwardingUserId={sharedUserId} roomId={roomId} />;
    }

    switch (icon) {
        case "decryptionFailure":
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.DecryptionFailure} />;
        case "normal":
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.Normal} />;
        case "warning":
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.Warning} />;
        default:
            return null;
    }
}
