/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface RoomListCollapseAllSectionsPayload extends ActionPayload {
    action: Action.RoomListCollapseAllSections;
    /** true = expand all, false = collapse all */
    expand: boolean;
}
