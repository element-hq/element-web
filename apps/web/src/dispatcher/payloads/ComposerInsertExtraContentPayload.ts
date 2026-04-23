/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { ComposerExtraContentPreview } from "@element-hq/element-web-module-api";
import type { Action } from "../actions";
import type { TimelineRenderingType } from "../../contexts/RoomContext";
import type { ComposerType } from "./ComposerInsertPayload";

export interface IComposerInsertEventContent<T = Record<string, unknown>> {
    action: Action.ComposerInsert;
    timelineRenderingType: TimelineRenderingType;
    composerType: ComposerType;
    /**
     * A unique key for the extra content.
     */
    key: string;
    /**
     * A renderable component to represent the extra content.
     */
    previewRenderable: ComposerExtraContentPreview<T>;
    /**
     * The extra data to be inserted into the event's "content".
     */
    eventContent: T;
}
