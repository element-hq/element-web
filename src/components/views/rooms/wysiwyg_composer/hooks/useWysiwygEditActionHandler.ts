/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RefObject, useCallback, useRef } from "react";

import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { type ActionPayload } from "../../../../../dispatcher/payloads";
import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { useDispatcher } from "../../../../../hooks/useDispatcher";
import { focusComposer } from "./utils";
import { ComposerType } from "../../../../../dispatcher/payloads/ComposerInsertPayload";
import { type ComposerFunctions } from "../types";
import { setSelection } from "../utils/selection";
import { useComposerContext } from "../ComposerContext";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

export function useWysiwygEditActionHandler(
    disabled: boolean,
    composerElement: RefObject<HTMLElement>,
    composerFunctions: ComposerFunctions,
): void {
    const roomContext = useScopedRoomContext("timelineRenderingType");
    const composerContext = useComposerContext();
    const timeoutId = useRef<number | null>(null);

    const handler = useCallback(
        (payload: ActionPayload) => {
            // don't let the user into the composer if it is disabled - all of these branches lead
            // to the cursor being in the composer
            if (disabled || !composerElement.current) return;

            const context = payload.context ?? TimelineRenderingType.Room;

            switch (payload.action) {
                case Action.FocusEditMessageComposer:
                    focusComposer(composerElement, context, roomContext, timeoutId);
                    break;
                case Action.ComposerInsert:
                    if (payload.timelineRenderingType !== roomContext.timelineRenderingType) break;
                    if (payload.composerType !== ComposerType.Edit) break;

                    if (payload.text) {
                        setSelection(composerContext.selection).then(() => composerFunctions.insertText(payload.text));
                    }
                    break;
            }
        },
        [disabled, composerElement, composerFunctions, timeoutId, roomContext, composerContext],
    );

    useDispatcher(defaultDispatcher, handler);
}
