/*
Copyright 2017 Travis Ralston

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";

export default class PinningUtils {
    /**
     * Event types that may be pinned.
     */
    public static pinnableEventTypes: (EventType | string)[] = [
        EventType.RoomMessage,
        M_POLL_START.name,
        M_POLL_START.altName,
    ];

    /**
     * Determines if the given event may be pinned.
     * @param {MatrixEvent} event The event to check.
     * @return {boolean} True if the event may be pinned, false otherwise.
     */
    public static isPinnable(event: MatrixEvent): boolean {
        if (!event) return false;
        if (!this.pinnableEventTypes.includes(event.getType())) return false;
        if (event.isRedacted()) return false;

        return true;
    }
}
