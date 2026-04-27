/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { ComposerExtraContentPreview, ComposerEventExtraContent } from "@element-hq/element-web-module-api";
import type { Action } from "../actions";

export interface ComposerInsertEventContentPayload<T = ComposerEventExtraContent> {
    action: Action.ComposerInsertExtraContent;
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
