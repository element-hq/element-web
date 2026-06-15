/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type MouseEventHandler, useEffect } from "react";
import { NotificationBadgeView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { useSettingValue } from "../../../../hooks/useSettings";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { NotificationBadgeViewModel } from "../../../../viewmodels/room/notification-badge/NotificationBadgeViewModel";

interface Props {
    "symbol": string | null;
    "count": number;
    "level": NotificationLevel;
    "knocked"?: boolean;
    /**
     * If true, where we would normally show a badge, we instead show a dot. No numeric count will
     * be displayed (but may affect whether the dot is displayed).
     */
    "forceDot"?: boolean;
    "tabIndex"?: number;
    "aria-label"?: string;
    "onClick"?: MouseEventHandler<HTMLButtonElement>;
}

export const StatelessNotificationBadge = ({
    symbol,
    count,
    level,
    knocked,
    forceDot,
    tabIndex,
    "aria-label": ariaLabel,
    onClick,
}: Readonly<Props>): JSX.Element => {
    const hideBold = useSettingValue("feature_hidebold");
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new NotificationBadgeViewModel({
                symbol,
                count,
                level,
                knocked,
                forceDot,
                hideBold,
                tabIndex,
                ariaLabel,
                onClick,
            }),
    );

    useEffect(() => {
        vm.setNotificationData({
            symbol,
            count,
            level,
            knocked,
        });
    }, [vm, symbol, count, level, knocked]);

    useEffect(() => {
        vm.setForceDot(!!forceDot);
    }, [vm, forceDot]);

    useEffect(() => {
        vm.setHideBold(!!hideBold);
    }, [vm, hideBold]);

    useEffect(() => {
        vm.setClickOptions({
            onClick,
            tabIndex,
            ariaLabel,
        });
    }, [vm, onClick, tabIndex, ariaLabel]);

    return <NotificationBadgeView vm={vm} />;
};
