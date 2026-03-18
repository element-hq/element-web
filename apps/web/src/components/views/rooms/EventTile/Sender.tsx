/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import SenderProfile from "../../messages/SenderProfile";
import { SenderMode } from "./EventTileModes";

type SenderProps = {
    mode: SenderMode;
    mxEvent: MatrixEvent;
    onClick?: () => void;
};

export function Sender({
    mode,
    mxEvent,
    onClick,
}: SenderProps): JSX.Element | undefined {
    switch (mode) {
        case SenderMode.Hidden:
            return undefined;
        case SenderMode.ComposerInsert:
            return <SenderProfile onClick={onClick} mxEvent={mxEvent} />;
        case SenderMode.Tooltip:
            return <SenderProfile mxEvent={mxEvent} withTooltip />;
        default:
            return <SenderProfile mxEvent={mxEvent} />;
    }
}
