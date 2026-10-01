/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Different browsers use different deltaModes. This causes different behaviour.
 * To avoid that we use this function to convert any event to pixels.
 * @param {WheelEvent} event to normalize
 * @returns {WheelEvent} normalized event event
 */
export function normalizeWheelEvent({ deltaMode, deltaX, deltaY, deltaZ, ...event }: WheelEvent): WheelEvent {
    const LINE_HEIGHT = 18;

    if (deltaMode === 1) {
        // Units are lines
        deltaX *= LINE_HEIGHT;
        deltaY *= LINE_HEIGHT;
        deltaZ *= LINE_HEIGHT;
    }

    return new WheelEvent("syntheticWheel", {
        deltaMode: 0,
        deltaY,
        deltaX,
        deltaZ,
        ...event,
    });
}
