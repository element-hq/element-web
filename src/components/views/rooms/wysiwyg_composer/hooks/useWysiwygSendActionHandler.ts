/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MutableRefObject, useCallback, useRef } from "react";

import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { type ActionPayload } from "../../../../../dispatcher/payloads";
import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { useDispatcher } from "../../../../../hooks/useDispatcher";
import { focusComposer } from "./utils";
import { type ComposerFunctions } from "../types";
import { ComposerType } from "../../../../../dispatcher/payloads/ComposerInsertPayload";
import { useComposerContext } from "../ComposerContext";
import { setSelection } from "../utils/selection";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

export function useWysiwygSendActionHandler(
    disabled: boolean,
    composerElement: MutableRefObject<HTMLElement>,
    composerFunctions: ComposerFunctions,
): void {
    const roomContext = useScopedRoomContext("timelineRenderingType");
    const composerContext = useComposerContext();
    const timeoutId = useRef<number | null>(null);

    const handler = useCallback(
        (payload: ActionPayload) => {
            // don't let the user into the composer if it is disabled - all of these branches lead
            // to the cursor being in the composer
            if (disabled || !composerElement?.current) return;

            const context = payload.context ?? TimelineRenderingType.Room;

            switch (payload.action) {
                case "reply_to_event":
                case Action.FocusAComposer:
                case Action.FocusSendMessageComposer:
                    focusComposer(composerElement, context, roomContext, timeoutId);
                    break;
                case Action.ClearAndFocusSendMessageComposer:
                    // When a thread is opened, prevent the main composer to steal the thread composer focus
                    if (payload.timelineRenderingType !== roomContext.timelineRenderingType) break;

                    composerFunctions.clear();
                    focusComposer(composerElement, context, roomContext, timeoutId);
                    break;
                case Action.ComposerInsert:
                    if (payload.timelineRenderingType !== roomContext.timelineRenderingType) break;
                    if (payload.composerType !== ComposerType.Send) break;

                    if (payload.userId) {
                        // TODO insert mention - see SendMessageComposer
                    } else if (payload.event) {
                        // TODO insert quote message - see SendMessageComposer
                    } else if (payload.text) {
                        setSelection(composerContext.selection).then(() => composerFunctions.insertText(payload.text));
                    }
                    break;
            }
        },
        [disabled, composerElement, roomContext, composerFunctions, composerContext],
    );

    useDispatcher(defaultDispatcher, handler);
}
