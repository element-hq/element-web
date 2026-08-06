/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface OnLoggedInPayload extends ActionPayload {
    action: Action.OnLoggedIn;

    client: MatrixClient;
}
