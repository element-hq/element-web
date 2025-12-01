/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, HistoryVisibility, type Room } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect } from "react";

import { useRoomState } from "../../../../hooks/useRoomState";
import { useSettingValue } from "../../../../hooks/useSettings";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";

interface HistoryVisibleBannerState {
    visible: boolean;
    onClose: () => void;
}

export const useHistoryVisibleBannerViewModel = (room: Room): HistoryVisibleBannerState => {
    const featureEnabled = useSettingValue("feature_share_history_on_invite");
    const acknowledged = useSettingValue("acknowledgedHistoryVisibility", room.roomId);

    const { isEncrypted, historyVisibility } = useRoomState(room, (state) => ({
        isEncrypted: state.getStateEvents(EventType.RoomEncryption, "") !== null,
        historyVisibility: state.getHistoryVisibility(),
    }));

    // --- Handlers ---

    const onClose = useCallback(() => {
        void SettingsStore.setValue("acknowledgedHistoryVisibility", room.roomId, SettingLevel.ROOM_ACCOUNT, true);
    }, [room.roomId]);

    // --- Effects ---

    useEffect(() => {
        // Condition on acknowledged to avoid entering an infinite update loop, since `SettingsStore.setValue` triggers a sync.
        if (historyVisibility === HistoryVisibility.Joined && acknowledged) {
            void SettingsStore.setValue("acknowledgedHistoryVisibility", room.roomId, SettingLevel.ROOM_ACCOUNT, false);
        }
    }, [historyVisibility, acknowledged, room.roomId]);

    const visible = featureEnabled && isEncrypted && historyVisibility !== HistoryVisibility.Joined && !acknowledged;

    return {
        visible,
        onClose,
    };
};
