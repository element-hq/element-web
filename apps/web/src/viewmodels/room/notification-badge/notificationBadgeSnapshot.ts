/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type NotificationBadgeViewSnapshot } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { formatCount } from "../../../utils/FormattingUtils";

export interface NotificationBadgeSnapshotInput {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    knocked?: boolean;
    forceDot?: boolean;
    hideBold: boolean;
}

export function computeNotificationBadgeViewSnapshot({
    symbol,
    count,
    level,
    knocked = false,
    forceDot = false,
    hideBold,
}: NotificationBadgeSnapshotInput): NotificationBadgeViewSnapshot {
    const shouldRender =
        (level !== NotificationLevel.None && !(hideBold && level === NotificationLevel.Activity)) || knocked;
    const hasUnreadCount = level >= NotificationLevel.Notification && (!!count || !!symbol);
    const isEmptyBadge = symbol === null && count === 0;

    let displaySymbol = symbol;
    if (displaySymbol === null && count > 0) {
        displaySymbol = formatCount(count);
    }

    const badgeType =
        forceDot || (level <= NotificationLevel.Activity && !knocked)
            ? "dot"
            : !displaySymbol || displaySymbol.length < 3
              ? "badge_2char"
              : "badge_3char";

    return {
        shouldRender,
        isVisible: isEmptyBadge || knocked ? true : hasUnreadCount,
        isNotification: level === NotificationLevel.Notification,
        isHighlight: level >= NotificationLevel.Highlight,
        isKnocked: knocked,
        badgeType,
        symbol: displaySymbol,
        knockLabel: _t("room|knock_sent"),
    };
}
