/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";
import { type IMatrixClientCreds } from "../../MatrixClientPeg";

export interface OverwriteLoginPayload extends ActionPayload {
    action: Action.OverwriteLogin;

    credentials: IMatrixClientCreds;
}
