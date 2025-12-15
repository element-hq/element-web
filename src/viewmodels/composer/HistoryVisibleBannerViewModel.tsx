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
    /**
     * The room instance associated with this banner view model.
     */
    room: Room;

    /**
     * The thread ID, if applicable, or null if not in a thread context.
     */
    threadId?: string | null;
}

export class HistoryVisibleBannerViewModel
    extends BaseViewModel<HistoryVisibleBannerViewSnapshot, Props>
    implements HistoryVisibleBannerViewModelInterface
{
    /**
     * Watcher ID for the "feature_share_history_on_invite" setting.
     */
    private readonly featureWatcher: string;

    /**
     * Watcher ID for the "acknowledgedHistoryVisibility" setting specific to the room.
     */
    private readonly acknowledgedWatcher: string;

    private static readonly computeSnapshot = (
        room: Room,
        threadId?: string | null,
    ): HistoryVisibleBannerViewSnapshot => {
        const featureEnabled = SettingsStore.getValue("feature_share_history_on_invite");
        const acknowledged = SettingsStore.getValue("acknowledgedHistoryVisibility", room.roomId);

        return {
            visible:
                featureEnabled &&
                !threadId &&
                room.hasEncryptionStateEvent() &&
                room.getHistoryVisibility() !== HistoryVisibility.Joined &&
                !acknowledged,
        };
    };

    public constructor(props: Props) {
        super(props, HistoryVisibleBannerViewModel.computeSnapshot(props.room, props.threadId));

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

        this.snapshot.set(HistoryVisibleBannerViewModel.computeSnapshot(this.props.room, this.props.threadId));
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
