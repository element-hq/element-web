/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type HistoryVisibleBannerViewModel as HistoryVisibleBannerViewModelInterface,
    type HistoryVisibleBannerViewSnapshot,
} from "@element-hq/web-shared-components";
import { HistoryVisibility, RoomStateEvent, type Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

interface Props {
    room: Room;
}

export class HistoryVisibleBannerViewModel
    extends BaseViewModel<HistoryVisibleBannerViewSnapshot, Props>
    implements HistoryVisibleBannerViewModelInterface
{
    private readonly featureWatcher: string;
    private readonly acknowledgedWatcher: string;

    private static readonly computeSnapshot = (room: Room): HistoryVisibleBannerViewSnapshot => {
        const featureEnabled = SettingsStore.getValue("feature_share_history_on_invite");
        const acknowledged = SettingsStore.getValue("acknowledgedHistoryVisibility", room.roomId);

        return {
            visible:
                featureEnabled &&
                room.hasEncryptionStateEvent() &&
                room.getHistoryVisibility() !== HistoryVisibility.Joined &&
                !acknowledged,
        };
    };

    public constructor(props: Props) {
        super(props, HistoryVisibleBannerViewModel.computeSnapshot(props.room));

        this.disposables.trackListener(props.room, RoomStateEvent.Update, () => this.setSnapshot());

        // `SettingsStore` is not an `EventListener`, so we must manage these manually.
        this.featureWatcher = SettingsStore.watchSetting(
            "feature_share_history_on_invite",
            null,
            (_key, _roomId, _level, value: boolean) => this.setSnapshot(),
        );
        this.acknowledgedWatcher = SettingsStore.watchSetting(
            "acknowledgedHistoryVisibility",
            props.room.roomId,
            (_key, _roomId, _level, value: boolean) => this.setSnapshot(),
        );
    }

    private setSnapshot(): void {
        const acknowledged = SettingsStore.getValue("acknowledgedHistoryVisibility", this.props.room.roomId);

        // Reset the acknowleded flag when the history visibility is set back to joined.
        if (this.props.room.getHistoryVisibility() === HistoryVisibility.Joined && acknowledged) {
            SettingsStore.setValue(
                "acknowledgedHistoryVisibility",
                this.props.room.roomId,
                SettingLevel.ROOM_ACCOUNT,
                false,
            );
        }

        this.snapshot.set(HistoryVisibleBannerViewModel.computeSnapshot(this.props.room));
    }

    /**
     * Revoke the banner's acknoledgement status.
     */
    public async revoke(): Promise<void> {
        await SettingsStore.setValue(
            "acknowledgedHistoryVisibility",
            this.props.room.roomId,
            SettingLevel.ROOM_ACCOUNT,
            false,
        );
    }

    /**
     * Called when the user dismisses the banner.
     */
    public async onClose(): Promise<void> {
        await SettingsStore.setValue(
            "acknowledgedHistoryVisibility",
            this.props.room.roomId,
            SettingLevel.ROOM_ACCOUNT,
            true,
        );
    }

    public dispose(): void {
        super.dispose();
        SettingsStore.unwatchSetting(this.featureWatcher);
        SettingsStore.unwatchSetting(this.acknowledgedWatcher);
    }
}
