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

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];

/**
 * Should the media event be visible in the client, or hidden.
 *
 * This function uses the `mediaPreviewConfig` setting to determine the rules for the room
 * along with the `showMediaEventIds` setting for specific events.
 *
 * A function may be provided to alter the visible state.
 *
 * @param The event that contains the media. If not provided, the global rule is used.
 *
 * @returns Returns a tuple of:
 *          A boolean describing the hidden status.
 *          A function to show or hide the event.
 */
export function useMediaVisible(mxEvent?: MatrixEvent): [boolean, (visible: boolean) => void] {
    const client = useMatrixClientContext();
    const roomId = mxEvent?.getRoomId();
    const mediaPreviewSetting = useSettingValue("mediaPreviewConfig", roomId);
    const eventVisibility = useSettingValue("showMediaEventIds");
    const room = roomId ? client.getRoom(roomId) ?? undefined : undefined;
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
            joinRule ? PRIVATE_JOIN_RULES.includes(joinRule) : false,
        ),
        setMediaVisible,
    ];
}
