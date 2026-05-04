/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, type JSX, type ReactNode } from "react";
import { useViewModel } from "@element-hq/web-shared-components";
import { CircleIcon, CheckCircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";

import { StaticNotificationState } from "../../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../NotificationBadge";
import { ReadReceiptGroup } from "../ReadReceiptGroup";
import type { IReadReceiptPosition } from "../ReadReceiptMarker";
import type { ReadReceiptProps } from "./types";
import {
    MessageStatusMode,
    type MessageStatusViewModel,
} from "../../../../viewmodels/room/timeline/event-tile/status/MessageStatusViewModel";

type MessageStatusProps = Readonly<{
    vm: MessageStatusViewModel;
    suppressReadReceiptAnimation: boolean;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    isTwelveHour?: boolean;
    checkUnmounting?: () => boolean;
}>;

function MessageStatusComponent({
    vm,
    suppressReadReceiptAnimation,
    readReceipts,
    readReceiptMap,
    isTwelveHour,
    checkUnmounting,
}: MessageStatusProps): JSX.Element | undefined {
    const snapshot = useViewModel(vm);
    const sentReceipt = getSentReceiptDetails(snapshot.mode, snapshot.label);
    const sentReceiptIcon = sentReceipt?.icon;
    const sentReceiptLabel = sentReceipt?.label;

    if (sentReceiptIcon && sentReceiptLabel) {
        return (
            <div className="mx_EventTile_msgOption">
                <div className="mx_ReadReceiptGroup">
                    <Tooltip label={sentReceiptLabel} placement="top-end">
                        <div className="mx_ReadReceiptGroup_button" role="status" aria-label={sentReceiptLabel}>
                            <span className="mx_ReadReceiptGroup_container">{sentReceiptIcon}</span>
                        </div>
                    </Tooltip>
                </div>
            </div>
        );
    }

    if (snapshot.mode === MessageStatusMode.ReadReceipts) {
        return (
            <ReadReceiptGroup
                readReceipts={[...(readReceipts ?? [])]}
                readReceiptMap={readReceiptMap ?? {}}
                checkUnmounting={checkUnmounting}
                suppressAnimation={suppressReadReceiptAnimation}
                isTwelveHour={isTwelveHour}
            />
        );
    }

    return undefined;
}

/** Renders the event-tile message status area. */
export const MessageStatus = memo(MessageStatusComponent);

function getSentReceiptDetails(
    mode: MessageStatusMode,
    label?: string,
): { icon: ReactNode; label: string } | undefined {
    if (!label) {
        return undefined;
    }

    switch (mode) {
        case MessageStatusMode.SentReceipt:
            return { icon: <CheckCircleIcon />, label };
        case MessageStatusMode.FailedReceipt:
            return { icon: <NotificationBadge notification={StaticNotificationState.RED_EXCLAMATION} />, label };
        case MessageStatusMode.EncryptingReceipt:
        case MessageStatusMode.SendingReceipt:
            return { icon: <CircleIcon />, label };
        default:
            return undefined;
    }
}
