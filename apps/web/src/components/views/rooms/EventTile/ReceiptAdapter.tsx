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

/**
 * A single read receipt entry displayed in the event tile receipt row.
 */
interface ReadReceiptProps {
    /** The user ID associated with the receipt. */
    userId: string;
    /** The room member metadata for the user, if available. */
    roomMember: RoomMember | null;
    /** Timestamp of the receipt in milliseconds since the Unix epoch. */
    ts: number;
}

/**
 * Props for the {@link ReceiptAdapter} component.
 */
interface ReceiptAdapterProps {
    /** Current receipt state for the event tile. */
    receiptState: EventTileReceiptState;
    /** Send status used when rendering the sent-state badge. */
    eventSendStatus?: EventStatus;
    /** Whether read receipts should be shown. */
    showReadReceipts?: boolean;
    /** Read receipts to render when the group is visible. */
    readReceipts?: ReadReceiptProps[];
    /** Read receipt positions keyed by user ID. */
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    /** Checks whether the receipt row is unmounting. */
    checkUnmounting?: () => boolean;
    /** Suppresses receipt animation when true. */
    suppressAnimation: boolean;
    /** Whether timestamps should use a 12-hour clock. */
    isTwelveHour?: boolean;
}

/**
 * Renders the send-state or read-receipt indicator for an event tile.
 */
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
