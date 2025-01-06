/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinedRoom as JoinedRoomEvent } from "@matrix-org/analytics-events/types/typescript/JoinedRoom";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

/* eslint-disable camelcase */
export interface JoinRoomReadyPayload extends Pick<ActionPayload, "action"> {
    action: Action.JoinRoomReady;
    roomId: string;

    // additional parameters for the purpose of metrics & instrumentation
    metricsTrigger: JoinedRoomEvent["trigger"];
}
/* eslint-enable camelcase */
