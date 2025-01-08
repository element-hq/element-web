/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Optional } from "matrix-events-sdk";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { InviteKind } from "../../components/views/dialogs/InviteDialogTypes";

export interface OpenInviteDialogPayload extends ActionPayload {
    action: Action.OpenInviteDialog;

    kind: InviteKind;
    onFinishedCallback: Optional<(results: boolean[]) => void>;

    call?: MatrixCall;
    roomId?: string;

    analyticsName: string;
    className: string;
}
