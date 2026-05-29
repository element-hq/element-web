/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type EventStatus, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";
import { CheckCircleIcon, CircleIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import { StaticNotificationState } from "../../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../NotificationBadge";
import { ReadReceiptGroup } from "../ReadReceiptGroup";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import { type EventTileReceiptState } from "../../../../viewmodels/room/timeline/event-tile/EventTileReceiptState";

interface ReadReceiptProps {
    userId: string;
    roomMember: RoomMember | null;
    ts: number;
}

interface ReceiptAdapterProps {
    receiptState: EventTileReceiptState;
    eventSendStatus?: EventStatus;
    showReadReceipts?: boolean;
    readReceipts?: ReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    checkUnmounting?: () => boolean;
    suppressAnimation: boolean;
    isTwelveHour?: boolean;
}

export function ReceiptAdapter({
    receiptState,
    eventSendStatus,
    showReadReceipts,
    readReceipts,
    readReceiptMap,
    checkUnmounting,
    suppressAnimation,
    isTwelveHour,
}: Readonly<ReceiptAdapterProps>): JSX.Element | null {
    if (receiptState.shouldShowSentReceipt || receiptState.shouldShowSendingReceipt) {
        return <SentReceipt messageState={eventSendStatus} />;
    }

    if (!showReadReceipts) {
        return null;
    }

    return (
        <ReadReceiptGroup
            readReceipts={readReceipts ?? []}
            readReceiptMap={readReceiptMap ?? {}}
            checkUnmounting={checkUnmounting}
            suppressAnimation={suppressAnimation}
            isTwelveHour={isTwelveHour}
        />
    );
}

interface SentReceiptProps {
    messageState: EventStatus | undefined;
}

function SentReceipt({ messageState }: Readonly<SentReceiptProps>): JSX.Element {
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

    return (
        <div className="mx_EventTile_msgOption">
            <div className="mx_ReadReceiptGroup">
                <Tooltip label={label} placement="top-end">
                    <div className="mx_ReadReceiptGroup_button" role="status">
                        <span className="mx_ReadReceiptGroup_container">{icon}</span>
                    </div>
                </Tooltip>
            </div>
        </div>
    );
}
