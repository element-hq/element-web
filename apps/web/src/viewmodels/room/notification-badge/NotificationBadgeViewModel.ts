/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type NotificationBadgeViewActions,
    type NotificationBadgeViewActivationEvent,
    type NotificationBadgeViewSnapshot,
} from "@element-hq/web-shared-components";

import SettingsStore from "../../../settings/SettingsStore";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { computeNotificationBadgeViewSnapshot } from "./notificationBadgeSnapshot";

export interface NotificationBadgeViewModelProps {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    knocked?: boolean;
    forceDot?: boolean;
    onClick?: (event: NotificationBadgeViewActivationEvent) => void;
}

interface InternalProps extends NotificationBadgeViewModelProps {
    hideBold: boolean;
}

export class NotificationBadgeViewModel
    extends BaseViewModel<NotificationBadgeViewSnapshot, InternalProps>
    implements NotificationBadgeViewActions
{
    private static readonly computeSnapshot = (props: InternalProps): NotificationBadgeViewSnapshot => ({
        ...computeNotificationBadgeViewSnapshot({
            symbol: props.symbol,
            count: props.count,
            level: props.level,
            knocked: props.knocked,
            forceDot: props.forceDot,
            hideBold: props.hideBold,
        }),
        isClickable: !!props.onClick,
    });

    public constructor(props: NotificationBadgeViewModelProps) {
        const internalProps: InternalProps = {
            ...props,
            hideBold: SettingsStore.getValue("feature_hidebold"),
        };

        super(internalProps, NotificationBadgeViewModel.computeSnapshot(internalProps));

        const hideBoldWatcherRef = SettingsStore.watchSetting("feature_hidebold", null, this.onHideBoldSettingChanged);
        this.disposables.track(() => SettingsStore.unwatchSetting(hideBoldWatcherRef));
    }

    public setSymbol(symbol: string | null): void {
        if (this.props.symbol === symbol) return;

        this.props = {
            ...this.props,
            symbol,
        };
        this.updateSnapshotFromProps();
    }

    public setCount(count: number): void {
        if (this.props.count === count) return;

        this.props = {
            ...this.props,
            count,
        };
        this.updateSnapshotFromProps();
    }

    public setLevel(level: NotificationLevel): void {
        if (this.props.level === level) return;

        this.props = {
            ...this.props,
            level,
        };
        this.updateSnapshotFromProps();
    }

    public setKnocked(knocked?: boolean): void {
        if (this.props.knocked === knocked) return;

        this.props = {
            ...this.props,
            knocked,
        };
        this.updateSnapshotFromProps();
    }

    public setForceDot(forceDot?: boolean): void {
        if (this.props.forceDot === forceDot) return;

        this.props = {
            ...this.props,
            forceDot,
        };
        this.updateSnapshotFromProps();
    }

    public setOnClick(onClick?: (event: NotificationBadgeViewActivationEvent) => void): void {
        if (this.props.onClick === onClick) return;

        this.props = {
            ...this.props,
            onClick,
        };
        this.snapshot.merge({ isClickable: !!onClick });
    }

    public readonly onClick = (event: NotificationBadgeViewActivationEvent): void => {
        this.props.onClick?.(event);
    };

    private setHideBold(hideBold: boolean): void {
        if (this.props.hideBold === hideBold) return;

        this.props = {
            ...this.props,
            hideBold,
        };
        this.updateSnapshotFromProps();
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(NotificationBadgeViewModel.computeSnapshot(this.props));
    }

    private readonly onHideBoldSettingChanged = (): void => {
        this.setHideBold(SettingsStore.getValue("feature_hidebold"));
    };
}
