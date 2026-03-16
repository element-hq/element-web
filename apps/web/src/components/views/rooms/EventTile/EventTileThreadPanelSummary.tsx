/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

export function EventTileThreadPanelSummary({
    replyCount,
    preview,
}: {
    replyCount: number;
    preview: ReactNode;
}): JSX.Element {
    return (
        <div className="mx_ThreadPanel_replies">
            <ThreadsIcon />
            <span className="mx_ThreadPanel_replies_amount">{replyCount}</span>
            {preview}
        </div>
    );
}
