/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";

export function EventTileMsgOption({
    sentReceiptIcon,
    sentReceiptLabel,
    readReceipts,
}: {
    sentReceiptIcon?: ReactNode;
    sentReceiptLabel?: string;
    readReceipts?: ReactNode;
}): JSX.Element | undefined {
    if (sentReceiptIcon && sentReceiptLabel) {
        return (
            <div className="mx_EventTile_msgOption">
                <div className="mx_ReadReceiptGroup">
                    <Tooltip label={sentReceiptLabel} placement="top-end">
                        <div className="mx_ReadReceiptGroup_button" role="status">
                            <span className="mx_ReadReceiptGroup_container">{sentReceiptIcon}</span>
                        </div>
                    </Tooltip>
                </div>
            </div>
        );
    }

    if (readReceipts) {
        return <>{readReceipts}</>;
    }

    return undefined;
}
