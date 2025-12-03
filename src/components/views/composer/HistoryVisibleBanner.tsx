/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { HistoryVisibleBannerView } from "@element-hq/web-shared-components";
import { EventType, type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useEffect, useMemo } from "react";

import { useRoomState } from "../../../hooks/useRoomState";
import { useSettingValue } from "../../../hooks/useSettings";
import { HistoryVisibleBannerViewModel } from "../../../viewmodels/composer/HistoryVisibleBannerViewModel";

export interface HistoryVisibleBannerProps {
    room: Room;
}

export function HistoryVisibleBanner({ room }: HistoryVisibleBannerProps): JSX.Element {
    const featureEnabled = useSettingValue("feature_share_history_on_invite");
    const acknowledged = useSettingValue("acknowledgedHistoryVisibility", room.roomId);

    const { isEncrypted, historyVisibility } = useRoomState(room, (state) => ({
        isEncrypted: state.getStateEvents(EventType.RoomEncryption, "") !== null,
        historyVisibility: state.getHistoryVisibility(),
    }));

    const vm = useMemo(
        () =>
            new HistoryVisibleBannerViewModel({
                room,
                featureEnabled,
                acknowledged,
                isEncrypted,
                historyVisibility,
            }),
        [room, featureEnabled, acknowledged, isEncrypted, historyVisibility],
    );

    useEffect(() => {
        return () => {
            vm.dispose();
        };
    }, [vm]);

    return <HistoryVisibleBannerView vm={vm} />;
}
