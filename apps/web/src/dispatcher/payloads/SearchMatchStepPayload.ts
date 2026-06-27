/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface SearchMatchStepPayload extends ActionPayload {
    action: Action.SearchMatchStep;

    /**
     * Which way to step the search match cursor: "next" advances to the older match, "previous" goes back to
     * the newer match. Both wrap around the ends of the match list.
     */
    direction: "next" | "previous";
}
