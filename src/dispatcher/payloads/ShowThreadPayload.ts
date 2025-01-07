/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

export interface ShowThreadPayload extends ActionPayload {
    action: Action.ShowThread;

    rootEvent: MatrixEvent;
    initialEvent?: MatrixEvent;
    highlighted?: boolean;
    scrollIntoView?: boolean;
    push?: boolean;
}
