/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";

export interface OpenForwardDialogPayload extends ActionPayload {
    action: Action.OpenForwardDialog;

    event: MatrixEvent;
    permalinkCreator: Optional<RoomPermalinkCreator>;
}
