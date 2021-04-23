/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Different browsers use different deltaModes. This causes different behaviour.
 * To avoid that we use this function to convert any event to pixels.
 * @param {WheelEvent} event to normalize
 * @returns {WheelEvent} normalized event event
 */
export function normalizeWheelEvent(event: WheelEvent): WheelEvent {
    const LINE_HEIGHT = 18;

    let deltaX;
    let deltaY;
    let deltaZ;

    if (event.deltaMode === 1) { // Units are lines
        deltaX = (event.deltaX * LINE_HEIGHT);
        deltaY = (event.deltaY * LINE_HEIGHT);
        deltaZ = (event.deltaZ * LINE_HEIGHT);
    } else {
        deltaX = event.deltaX;
        deltaY = event.deltaY;
        deltaZ = event.deltaZ;
    }

    return new WheelEvent(
        "syntheticWheel",
        {
            deltaMode: 0,
            deltaY: deltaY,
            deltaX: deltaX,
            deltaZ: deltaZ,
            ...event,
        },
    );
}
