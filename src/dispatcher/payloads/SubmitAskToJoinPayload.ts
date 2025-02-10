/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type KnockRoomOpts } from "matrix-js-sdk/src/matrix";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface SubmitAskToJoinPayload extends Pick<ActionPayload, "action"> {
    action: Action.SubmitAskToJoin;

    roomId: string;
    opts?: KnockRoomOpts;
}
