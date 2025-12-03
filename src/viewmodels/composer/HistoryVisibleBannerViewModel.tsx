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
import { HistoryVisibility, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

interface Props {
    client: MatrixClient;
    room: Room;
    featureEnabled: boolean;
    acknowledged: boolean;
    isEncrypted: boolean;
    historyVisibility: HistoryVisibility;
}

export class HistoryVisibleBannerViewModel
    extends BaseViewModel<HistoryVisibleBannerViewSnapshot, Props>
    implements HistoryVisibleBannerViewModelInterface
{
    private static readonly computeSnapshot = (
        featureEnabled: boolean,
        acknowledged: boolean,
        isEncrypted: boolean,
        historyVisibility: HistoryVisibility,
    ): HistoryVisibleBannerViewSnapshot => {
        return {
            visible: featureEnabled && isEncrypted && historyVisibility !== HistoryVisibility.Joined && !acknowledged,
        };
    };

    public constructor(props: Props) {
        super(
            props,
            HistoryVisibleBannerViewModel.computeSnapshot(
                props.featureEnabled,
                props.acknowledged,
                props.isEncrypted,
                props.historyVisibility,
            ),
        );

        // Reset the acknowleded flag when the history visibility is set back to joined.
        if (props.historyVisibility === HistoryVisibility.Joined && props.acknowledged) {
            this.revoke();
        }
    }

    /**
     * Revoke the banner's acknoledgement status.
     */
    private async revoke(): Promise<void> {
        await SettingsStore.setValue(
            "acknowledgedHistoryVisibility",
            this.props.room.roomId,
            SettingLevel.ROOM_ACCOUNT,
            false,
        );
    }

    /**
     * Mark the banner as acknowledged.
     */
    private async acknowledge(): Promise<void> {
        await SettingsStore.setValue(
            "acknowledgedHistoryVisibility",
            this.props.room.roomId,
            SettingLevel.ROOM_ACCOUNT,
            true,
        );
    }

    /**
     * Called when the user dismisses the banner.
     */
    public async onClose(): Promise<void> {
        await this.acknowledge();
    }
}
