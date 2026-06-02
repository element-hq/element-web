/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";
import { AskToJoinIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import styles from "./NotificationBadgeView.module.css";

export type NotificationBadgeType = "dot" | "badge_2char" | "badge_3char";

export interface NotificationBadgeViewSnapshot {
    /**
     * Controls whether the badge root should render.
     */
    shouldRender: boolean;
    /**
     * Controls whether the badge receives the visible styling class.
     */
    isVisible: boolean;
    /**
     * Marks the badge as a regular notification.
     */
    isNotification: boolean;
    /**
     * Marks the badge as a highlight notification.
     */
    isHighlight: boolean;
    /**
     * Marks the badge as representing a knock request.
     */
    isKnocked: boolean;
    /**
     * Controls the visual badge shape.
     */
    badgeType: NotificationBadgeType;
    /**
     * Display text for non-knock badges.
     */
    symbol: string | null;
    /**
     * Accessible label for the knock icon.
     */
    knockLabel?: string;
}

export type NotificationBadgeViewModel = ViewModel<NotificationBadgeViewSnapshot>;

interface NotificationBadgeViewProps {
    vm: NotificationBadgeViewModel;
}

export function NotificationBadgeView({ vm }: Readonly<NotificationBadgeViewProps>): JSX.Element {
    const { shouldRender, isVisible, isNotification, isHighlight, isKnocked, badgeType, symbol, knockLabel } =
        useViewModel(vm);

    if (!shouldRender) {
        return <></>;
    }

    const classes = classNames(styles.notificationBadge, "mx_NotificationBadge", {
        [styles.visible]: isVisible,
        [styles.notification]: isNotification,
        [styles.highlight]: isHighlight,
        [styles.dot]: badgeType === "dot",
        [styles.badge2Char]: badgeType === "badge_2char",
        [styles.badge3Char]: badgeType === "badge_3char",

        "mx_NotificationBadge_visible": isVisible,
        "mx_NotificationBadge_level_notification": isNotification,
        "mx_NotificationBadge_level_highlight": isHighlight,
        "mx_NotificationBadge_knocked": isKnocked,
        // Exactly one of mx_NotificationBadge_dot, mx_NotificationBadge_2char, mx_NotificationBadge_3char.
        "mx_NotificationBadge_dot": badgeType === "dot",
        "mx_NotificationBadge_2char": badgeType === "badge_2char",
        "mx_NotificationBadge_3char": badgeType === "badge_3char",
        // Badges with text should always use light colors.
        "cpd-theme-light": badgeType !== "dot",
    });

    const content =
        isKnocked && knockLabel ? (
            <AskToJoinIcon aria-label={knockLabel} />
        ) : (
            <span className={classNames(styles.count, "mx_NotificationBadge_count")}>{symbol}</span>
        );

    return <div className={classes}>{content}</div>;
}
