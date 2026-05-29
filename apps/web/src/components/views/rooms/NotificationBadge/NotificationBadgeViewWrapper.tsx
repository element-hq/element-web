/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode, type Ref, useEffect } from "react";
import {
    NotificationBadgeView,
    type NotificationBadgeViewActivationEvent,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { NotificationBadgeViewModel } from "../../../../viewmodels/room/notification-badge/NotificationBadgeViewModel";

interface NotificationBadgeViewWrapperProps {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    knocked?: boolean;
    forceDot?: boolean;
    onClick?: (event: NotificationBadgeViewActivationEvent) => void;
    tabIndex?: number;
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
}

export function NotificationBadgeViewWrapper({
    symbol,
    count,
    level,
    knocked,
    forceDot,
    onClick,
    tabIndex,
    children,
    ref,
}: Readonly<NotificationBadgeViewWrapperProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new NotificationBadgeViewModel({
                symbol,
                count,
                level,
                knocked,
                forceDot,
                onClick,
            }),
    );

    useEffect(() => {
        vm.setSymbol(symbol);
    }, [symbol, vm]);

    useEffect(() => {
        vm.setCount(count);
    }, [count, vm]);

    useEffect(() => {
        vm.setLevel(level);
    }, [level, vm]);

    useEffect(() => {
        vm.setKnocked(knocked);
    }, [knocked, vm]);

    useEffect(() => {
        vm.setForceDot(forceDot);
    }, [forceDot, vm]);

    useEffect(() => {
        vm.setOnClick(onClick);
    }, [onClick, vm]);

    return (
        <NotificationBadgeView vm={vm} tabIndex={tabIndex} ref={ref}>
            {children}
        </NotificationBadgeView>
    );
}
