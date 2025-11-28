/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _t, Banner } from "@element-hq/web-shared-components";
import { Button } from "@vector-im/compound-web";
import { EventType, HistoryVisibility, type Room } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useEffect } from "react";

import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";
import { useSettingValue } from "../../../../hooks/useSettings";
import { useRoomState } from "../../../../hooks/useRoomState";

interface HistoryVisibleBannerProps {
    room: Room;
}

/**
 * A component to alert that history is shared to new members of the room.
 *
 * @example
 * ```tsx
 *   <HistoryVisibleBanner room={room} />
 * ```
 */
export const HistoryVisibleBanner: React.FC<HistoryVisibleBannerProps> = ({ room }) => {
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

    const shouldShow = featureEnabled && isEncrypted && historyVisibility !== HistoryVisibility.Joined && !acknowledged;

    if (!shouldShow) {
        return null;
    }

    return (
        <Banner
            type="info"
            actions={
                <Button
                    as="a"
                    href="https://element.io/en/help#e2ee-history-sharing"
                    target="_blank"
                    kind="tertiary"
                    size="sm"
                >
                    {_t("action|learn_more")}
                </Button>
            }
            onClose={onClose}
        >
            {_t("room|status_bar|history_visible")}
        </Banner>
    );
};
