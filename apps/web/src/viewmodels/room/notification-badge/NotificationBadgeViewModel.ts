/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEventHandler } from "react";
import {
    BaseViewModel,
    type NotificationBadgeType,
    type NotificationBadgeViewModel as NotificationBadgeViewModelInterface,
    type NotificationBadgeViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { type NotificationState } from "../../../stores/notifications/NotificationState";
import { formatCount } from "../../../utils/FormattingUtils";

export interface NotificationBadgeData {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    knocked?: boolean;
}

export interface NotificationBadgeViewModelProps extends NotificationBadgeData {
    /**
     * If true, hide badges that would render as a dot.
     */
    hideIfDot?: boolean;
    /**
     * If true, render a dot even when the badge has a count.
     */
    forceDot?: boolean;
    /**
     * Whether activity-level bold indicators are disabled by the user.
     */
    hideBold?: boolean;
    /**
     * Whether to show the unsent-message tooltip when the level is Unsent.
     */
    showUnsentTooltip?: boolean;
    /**
     * Accessible label for clickable badges.
     */
    ariaLabel?: string;
    /**
     * Tab index for clickable badges.
     */
    tabIndex?: number;
    /**
     * Called when an interactive badge is activated.
     */
    onClick?: MouseEventHandler<HTMLButtonElement>;
}

function getBadgeType(
    level: NotificationLevel,
    symbol: string | null,
    forceDot?: boolean,
    knocked?: boolean,
): NotificationBadgeType {
    if (!knocked && (forceDot || level <= NotificationLevel.Activity)) {
        return "dot";
    }

    return symbol && symbol.length >= 3 ? "badge_3char" : "badge_2char";
}

export function notificationBadgeDataFromNotification(notification: NotificationState): NotificationBadgeData {
    return {
        symbol: notification.symbol,
        count: notification.count,
        level: notification.level,
        knocked: notification.knocked,
    };
}

export class NotificationBadgeViewModel
    extends BaseViewModel<NotificationBadgeViewSnapshot, NotificationBadgeViewModelProps>
    implements NotificationBadgeViewModelInterface
{
    private static readonly computeSnapshot = (
        props: NotificationBadgeViewModelProps,
    ): NotificationBadgeViewSnapshot => {
        const knocked = !!props.knocked;
        const isIdle = props.level <= NotificationLevel.None;
        const hiddenByBoldSetting = !!props.hideBold && props.level === NotificationLevel.Activity;
        const hiddenByDotSetting = !!props.hideIfDot && props.level < NotificationLevel.Notification;
        const hasUnreadCount = props.level >= NotificationLevel.Notification && (!!props.count || !!props.symbol);
        const isEmptyBadge = props.symbol === null && props.count === 0;
        const isRendered = !((isIdle || hiddenByBoldSetting) && !knocked) && !hiddenByDotSetting;
        const isVisible = isEmptyBadge || knocked || hasUnreadCount;
        const displaySymbol = props.symbol === null && props.count > 0 ? formatCount(props.count) : props.symbol;

        return {
            shouldRender: isRendered,
            isVisible: isRendered && isVisible,
            isNotification: props.level === NotificationLevel.Notification,
            isHighlight: props.level >= NotificationLevel.Highlight,
            isKnocked: knocked,
            badgeType: getBadgeType(props.level, displaySymbol, props.forceDot, knocked),
            symbol: displaySymbol,
            knockLabel: _t("room|knock_sent"),
            isClickable: !!props.onClick,
            ariaLabel: props.ariaLabel,
            tabIndex: props.tabIndex,
            tooltipLabel:
                props.showUnsentTooltip && props.level === NotificationLevel.Unsent
                    ? _t("notifications|message_didnt_send")
                    : undefined,
        };
    };

    public constructor(props: NotificationBadgeViewModelProps) {
        super(props, NotificationBadgeViewModel.computeSnapshot(props));
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(NotificationBadgeViewModel.computeSnapshot(this.props));
    }

    public setNotificationData(data: NotificationBadgeData): void {
        this.props = {
            ...this.props,
            ...data,
        };
        this.updateSnapshotFromProps();
    }

    public setHideIfDot(hideIfDot: boolean): void {
        this.props = {
            ...this.props,
            hideIfDot,
        };
        this.updateSnapshotFromProps();
    }

    public setForceDot(forceDot: boolean): void {
        this.props = {
            ...this.props,
            forceDot,
        };
        this.updateSnapshotFromProps();
    }

    public setHideBold(hideBold: boolean): void {
        this.props = {
            ...this.props,
            hideBold,
        };
        this.updateSnapshotFromProps();
    }

    public setShowUnsentTooltip(showUnsentTooltip: boolean): void {
        this.props = {
            ...this.props,
            showUnsentTooltip,
        };
        this.updateSnapshotFromProps();
    }

    public setClickOptions({
        onClick,
        ariaLabel,
        tabIndex,
    }: Pick<NotificationBadgeViewModelProps, "onClick" | "ariaLabel" | "tabIndex">): void {
        this.props = {
            ...this.props,
            onClick,
            ariaLabel,
            tabIndex,
        };
        this.updateSnapshotFromProps();
    }

    public onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        this.props.onClick?.(event);
    };
}
