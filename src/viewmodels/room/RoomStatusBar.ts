/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type RoomStatusBarViewModel as RoomStatusBarViewModelInterface,
    type RoomStatusBarViewSnapshot,
} from "@element-hq/web-shared-components";
import { HistoryVisibility, type Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

interface Props {
    room: Room;
    onVisible: () => void;
    onHidden: () => void;
}

export class RoomStatusBarViewModel
    extends BaseViewModel<RoomStatusBarViewSnapshot, Props>
    implements RoomStatusBarViewModelInterface
{

    private static readonly computeSnapshot = (
        room: Room
    ): RoomStatusBarViewSnapshot => {
        const featureEnabled = SettingsStore.getValue("feature_share_history_on_invite");
        const acknowledged = SettingsStore.getValue("acknowledgedHistoryVisibility", room.roomId);

        return {
            visible: true
        };
    };

    public constructor(props: Props) {
        super(props, RoomStatusBarViewModel.computeSnapshot(props.room));
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

        this.snapshot.set(RoomStatusBarViewModel.computeSnapshot(this.props.room, this.props.threadId));
    }

    public dispose(): void {
        super.dispose();
    }
}
