/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useSettingValue } from "./useSettings";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { getMediaVisibility, setMediaVisibility } from "../utils/media/mediaVisibility";

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
    useSettingValue("mediaPreviewConfig", mxEvent?.getRoomId());
    useSettingValue("showMediaEventIds");

    const setMediaVisible = useCallback(
        (visible: boolean) => {
            if (!mxEvent) return;
            void setMediaVisibility(mxEvent, visible);
        },
        [mxEvent],
    );

    return [mxEvent ? getMediaVisibility(mxEvent, client) : false, setMediaVisible];
}
