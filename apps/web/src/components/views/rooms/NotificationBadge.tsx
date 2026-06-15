/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, type MouseEventHandler } from "react";
import { NotificationBadgeView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { useSettingValue } from "../../../hooks/useSettings";
import { type NotificationState, NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import {
    notificationBadgeDataFromNotification,
    NotificationBadgeViewModel,
} from "../../../viewmodels/notifications/NotificationBadgeViewModel";

interface Props {
    "notification": NotificationState;

    /**
     * If true, show nothing if the notification would only cause a dot to be shown rather than
     * a badge. That is: only display badges and not dots. Default: false.
     */
    "hideIfDot"?: boolean;

    /**
     * The room ID, if any, the badge represents.
     *
     * @deprecated retained for compatibility with existing callers.
     */
    "roomId"?: string;

    "showUnsentTooltip"?: boolean;
    "tabIndex"?: number;
    "aria-label"?: string;
    "onClick"?: MouseEventHandler<HTMLButtonElement>;
}

export default function NotificationBadge({
    notification,
    hideIfDot,
    showUnsentTooltip,
    tabIndex,
    "aria-label": ariaLabel,
    onClick,
}: Readonly<Props>): JSX.Element {
    const hideBold = useSettingValue("feature_hidebold");
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new NotificationBadgeViewModel({
                ...notificationBadgeDataFromNotification(notification),
                hideIfDot,
                hideBold,
                showUnsentTooltip,
                tabIndex,
                ariaLabel,
                onClick,
            }),
    );

    useEffect(() => {
        vm.setNotificationData(notificationBadgeDataFromNotification(notification));

        const onNotificationUpdate = (): void => {
            vm.setNotificationData(notificationBadgeDataFromNotification(notification));
        };

        notification.on(NotificationStateEvents.Update, onNotificationUpdate);
        return () => {
            notification.off(NotificationStateEvents.Update, onNotificationUpdate);
        };
    }, [vm, notification]);

    useEffect(() => {
        vm.setHideIfDot(!!hideIfDot);
    }, [vm, hideIfDot]);

    useEffect(() => {
        vm.setHideBold(!!hideBold);
    }, [vm, hideBold]);

    useEffect(() => {
        vm.setShowUnsentTooltip(!!showUnsentTooltip);
    }, [vm, showUnsentTooltip]);

    useEffect(() => {
        vm.setClickOptions({
            onClick,
            tabIndex,
            ariaLabel,
        });
    }, [vm, onClick, tabIndex, ariaLabel]);

    return <NotificationBadgeView vm={vm} />;
}
