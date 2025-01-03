/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RoomMember, User } from "matrix-js-sdk/src/matrix";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

export interface ViewUserPayload extends ActionPayload {
    action: Action.ViewUser;

    /**
     * The member to view. May be null or falsy to indicate that no member
     * should be shown (hide whichever relevant components).
     */
    member?: RoomMember | User;
}
