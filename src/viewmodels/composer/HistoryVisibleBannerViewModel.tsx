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

/**
 * A collection of {@link HistoryVisibility} levels that trigger the display of the history visible banner.
 */
const BANNER_VISIBLE_LEVELS = [HistoryVisibility.Shared, HistoryVisibility.WorldReadable];

interface Props {
    /**
     * The room instance associated with this banner view model.
     */
    room: Room;

    /**
     * Whether or not the current user is able to send messages in this room.
     */
    canSendMessages: boolean;

    /**
     * If not null, indicates the ID of the thread currently being viewed in the thread
     * timeline side view, where the banner view is displayed as a child of the message
     * composer.
     */
    threadId: string | null;
}

/**
 * View model for the history visible banner, which prompts users that the current room
 * history may be shared with new invitees, if they have not already acknowledged the
 * banner.
 *
 * The view model operates using a simple 2-case algorithm:
 *
 * 1. When a user opens an encrypted room where `history_visibility` is not set to `joined`,
 *    and the user hasn't previously dismissed it for this particular room, display a banner.
 *    If the user dismisses the banner, update the client's local store to record that the
 *    banner has been dismissed.
 * 2. When the user opens an encrypted room where `history_visibility` is set to `joined`, clear
 *    the dismissal flag if it was previously set. This ensures that if the room's history
 *    visibility changes from public to private and back to public, the banner will reappear
 *    when appropriate.
 *
 * This banner is only shown in the regular timeline view, not the thread timeline view, which is
 * done by conditioning on the presence of `threadId` in the viewmodel's {@link Props}.
 *
 * See https://github.com/element-hq/element-meta/issues/2875 for more information.
 */
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

    /**
     * Computes the latest banner snapshot given the VM's props.
     * @param props - See {@link Props}.
     * @returns The latest snapshot. See {@link HistoryVisibleBannerViewSnapshot}.
     */
    private static readonly computeSnapshot = ({
        room,
        canSendMessages,
        threadId,
    }: Props): HistoryVisibleBannerViewSnapshot => {
        const featureEnabled = SettingsStore.getValue("feature_share_history_on_invite");
        const acknowledged = SettingsStore.getValue("acknowledgedHistoryVisibility", room.roomId);
        const isHistoryVisible = BANNER_VISIBLE_LEVELS.includes(room.getHistoryVisibility());

        // This implements point 1. of the algorithm described above. In the order below, all
        // of the following must be true for the banner to display:
        // - The room history sharing feature must be enabled.
        // - The room must be encrypted.
        // - The user must be able to send messages.
        // - The history must be visible.
        // - The view should not be part of a thread timeline.
        // - The user must not have acknowledged the banner.
        return {
            visible:
                featureEnabled &&
                room.hasEncryptionStateEvent() &&
                canSendMessages &&
                isHistoryVisible &&
                !threadId &&
                !acknowledged,
        };
    };

    /**
     * Creates a new view model instance.
     * @param props - Properties for this view model. See {@link Props}.
     */
    public constructor(props: Props) {
        super(props, HistoryVisibleBannerViewModel.computeSnapshot(props));

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

    /**
     * Recompute and update this VM instance's snapshot. This will update the `acknowledgedHistoryVisibility`
     * store entry if necessary.
     */
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

        this.snapshot.set(HistoryVisibleBannerViewModel.computeSnapshot(this.props));
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

    /**
     * Dispose of the viewmodel and its settings listeners.
     */
    public dispose(): void {
        super.dispose();
        SettingsStore.unwatchSetting(this.featureWatcher);
        SettingsStore.unwatchSetting(this.acknowledgedWatcher);
    }
}
