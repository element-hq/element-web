/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

/* eslint-disable camelcase */
export interface ThreadPayload extends Pick<ActionPayload, "action"> {
    action: Action.ViewThread;

    thread_id: string | null;
}
/* eslint-enable camelcase */
