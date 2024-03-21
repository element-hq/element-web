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
