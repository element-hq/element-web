/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComposerApi as ModuleComposerApi } from "@element-hq/element-web-module-api";

import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ComposerInsertPayload } from "../dispatcher/payloads/ComposerInsertPayload";
import { TimelineRenderingType } from "../contexts/RoomContext";

export class ComposerApi implements ModuleComposerApi {
    public insertTextIntoComposer(text: string): void {
        defaultDispatcher.dispatch({
            action: Action.ComposerInsert,
            text,
            timelineRenderingType: TimelineRenderingType.Room,
        } satisfies ComposerInsertPayload);
    }
}
