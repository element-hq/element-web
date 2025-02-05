/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface OpenToTabPayload extends ActionPayload {
    action: Action.ViewUserSettings | string; // TODO: Add room settings action

    /**
     * The tab ID to open in the settings view to start, if possible.
     */
    initialTabId?: string;

    /**
     * Additional properties to pass to the settings view.
     */
    props?: Record<string, any>;
}
