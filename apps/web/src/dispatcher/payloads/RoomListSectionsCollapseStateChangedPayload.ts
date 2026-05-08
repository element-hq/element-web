/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type CollapseSectionsOption } from "@element-hq/web-shared-components";

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface RoomListSectionsCollapseStateChangedPayload extends ActionPayload {
    action: Action.RoomListSectionsCollapseStateChanged;
    /**
     * The new collapse state for the room list sections.
     * If undefined, the feature is disabled.
     */
    collapseSections?: CollapseSectionsOption;
}
