/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";
import { JoinRule, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useSettingValue } from "./useSettings";
import { useRoomState } from "./useRoomState";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { computeMediaVisibility, setMediaVisibility } from "../utils/media/mediaVisibility";

/**
 * Determine whether media for an event should be visible in the client and expose a setter for
 * a per-event override.
 *
 * Visibility is resolved from the effective `mediaPreviewConfig` setting together with any
 * event-specific overrides stored in `showMediaEventIds`.
 *
 * @param mxEvent - The event that contains the media. If omitted, visibility is derived from the
 * current setting defaults and the returned setter is a no-op.
 *
 * @returns A tuple containing the effective visibility for the event and a function that stores a
 * device-local visibility override for that event.
 */
export function useMediaVisible(mxEvent?: MatrixEvent): [boolean, (visible: boolean) => void] {
    const client = useMatrixClientContext();
    const roomId = mxEvent?.getRoomId();
    const mediaPreviewSetting = useSettingValue("mediaPreviewConfig", roomId);
    const eventVisibility = useSettingValue("showMediaEventIds");
    const room = roomId ? (client.getRoom(roomId) ?? undefined) : undefined;
    const joinRule = useRoomState(room, (state) => state.getJoinRule());

    const setMediaVisible = useCallback(
        (visible: boolean) => {
            if (!mxEvent) return;
            void setMediaVisibility(mxEvent, visible);
        },
        [mxEvent],
    );

    return [
        computeMediaVisibility(
            mediaPreviewSetting,
            eventVisibility,
            client.getUserId() ?? undefined,
            mxEvent?.getId(),
            mxEvent?.getSender(),
            joinRule ? [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted].includes(joinRule) : false,
        ),
        setMediaVisible,
    ];
}
