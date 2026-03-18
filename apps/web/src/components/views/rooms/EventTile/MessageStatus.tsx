/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { CircleIcon, CheckCircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";
import { type EventStatus } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { StaticNotificationState } from "../../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../NotificationBadge";
import { ReadReceiptGroup } from "../ReadReceiptGroup";
import type { IReadReceiptPosition } from "../ReadReceiptMarker";
import type { ReadReceiptProps } from "./EventTile";

interface MessageStatusProps {
    messageState: EventStatus | undefined;
    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    showReadReceipts: boolean;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    isTwelveHour?: boolean;
    checkUnmounting?: () => boolean;
    suppressReadReceiptAnimation: boolean;
}

export function MessageStatus({
    messageState,
    shouldShowSentReceipt,
    shouldShowSendingReceipt,
    showReadReceipts,
    readReceipts,
    readReceiptMap,
    checkUnmounting,
    isTwelveHour,
    suppressReadReceiptAnimation,
}: MessageStatusProps): JSX.Element | undefined {
    const sentReceipt = getSentReceiptDetails(messageState, shouldShowSentReceipt, shouldShowSendingReceipt);
    const sentReceiptIcon = sentReceipt?.icon;
    const sentReceiptLabel = sentReceipt?.label;
    const receiptGroup = showReadReceipts ? (
        <ReadReceiptGroup
            readReceipts={[...(readReceipts ?? [])]}
            readReceiptMap={readReceiptMap ?? {}}
            checkUnmounting={checkUnmounting}
            suppressAnimation={suppressReadReceiptAnimation}
            isTwelveHour={isTwelveHour}
        />
    ) : undefined;

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

    if (receiptGroup) {
        return <>{receiptGroup}</>;
    }

    return undefined;
}

function getSentReceiptDetails(
    messageState: EventStatus | undefined,
    shouldShowSentReceipt: boolean,
    shouldShowSendingReceipt: boolean,
): { icon: ReactNode; label: string } | undefined {
    if (!shouldShowSentReceipt && !shouldShowSendingReceipt) {
        return undefined;
    }

    const isSent = !messageState || messageState === "sent";
    const isFailed = messageState === "not_sent";

    let icon: JSX.Element | undefined;
    let label: string | undefined;
    if (messageState === "encrypting") {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_encrypting");
    } else if (isSent) {
        icon = <CheckCircleIcon />;
        label = _t("timeline|send_state_sent");
    } else if (isFailed) {
        icon = <NotificationBadge notification={StaticNotificationState.RED_EXCLAMATION} />;
        label = _t("timeline|send_state_failed");
    } else {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_sending");
    }

    return icon && label ? { icon, label } : undefined;
}
