/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { E2eMessageSharedIcon } from "./E2eMessageSharedIcon";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";
import { EncryptionIndicatorMode } from "./EventTileModes";

type EncryptionIndicatorProps = {
    icon: EncryptionIndicatorMode;
    title?: string;
    sharedUserId?: string;
    roomId?: string;
};

export function EncryptionIndicator({
    icon,
    title,
    sharedUserId,
    roomId,
}: EncryptionIndicatorProps): JSX.Element | null {
    if (sharedUserId && roomId) {
        return <E2eMessageSharedIcon keyForwardingUserId={sharedUserId} roomId={roomId} />;
    }

    switch (icon) {
        case EncryptionIndicatorMode.DecryptionFailure:
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.DecryptionFailure} />;
        case EncryptionIndicatorMode.Normal:
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.Normal} />;
        case EncryptionIndicatorMode.Warning:
            return <E2ePadlock title={title ?? ""} icon={E2ePadlockIcon.Warning} />;
        default:
            return null;
    }
}
