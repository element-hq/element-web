/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

const UNSIGNED_KEY = "io.element.late_event";

/**
 * This metadata describes when events arrive late after a net-split to offer improved UX.
 */
interface UnsignedLateEventInfo {
    /**
     * Milliseconds since epoch representing the time the event was received by the server
     */
    received_at: number;
    /**
     * An opaque identifier representing the group the server has put the late arriving event into
     */
    group_id: string;
}

/**
 * Get io.element.late_event metadata from unsigned as sent by the server.
 *
 * @experimental this is not in the Matrix spec and needs special server support
 * @param mxEvent the Matrix Event to get UnsignedLateEventInfo on
 */
export function getLateEventInfo(mxEvent: MatrixEvent): UnsignedLateEventInfo | undefined {
    return mxEvent.getUnsigned()[UNSIGNED_KEY];
}
