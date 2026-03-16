/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import SenderProfile from "../../messages/SenderProfile";

export function EventTileSenderProfile({
    mode,
    mxEvent,
    onClick,
}: {
    mode: "hidden" | "default" | "composerInsert" | "tooltip";
    mxEvent: MatrixEvent;
    onClick?: () => void;
}): JSX.Element | undefined {
    switch (mode) {
        case "hidden":
            return undefined;
        case "composerInsert":
            return <SenderProfile onClick={onClick} mxEvent={mxEvent} />;
        case "tooltip":
            return <SenderProfile mxEvent={mxEvent} withTooltip />;
        default:
            return <SenderProfile mxEvent={mxEvent} />;
    }
}
