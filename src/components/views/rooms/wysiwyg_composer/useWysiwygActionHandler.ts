/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useRef } from "react";

import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { ActionPayload } from "../../../../dispatcher/payloads";
import { IRoomState } from "../../../structures/RoomView";
import { TimelineRenderingType, useRoomContext } from "../../../../contexts/RoomContext";
import { useDispatcher } from "../../../../hooks/useDispatcher";

export function useWysiwygActionHandler(
    disabled: boolean,
    composerElement: React.MutableRefObject<HTMLElement>,
) {
    const roomContext = useRoomContext();
    const timeoutId = useRef<number>();

    useDispatcher(defaultDispatcher, (payload: ActionPayload) => {
        // don't let the user into the composer if it is disabled - all of these branches lead
        // to the cursor being in the composer
        if (disabled) return;

        const context = payload.context ?? TimelineRenderingType.Room;

        switch (payload.action) {
            case "reply_to_event":
            case Action.FocusSendMessageComposer:
                focusComposer(composerElement, context, roomContext, timeoutId);
                break;
            // TODO: case Action.ComposerInsert: - see SendMessageComposer
        }
    });
}

function focusComposer(
    composerElement: React.MutableRefObject<HTMLElement>,
    renderingType: TimelineRenderingType,
    roomContext: IRoomState,
    timeoutId: React.MutableRefObject<number>,
) {
    if (renderingType === roomContext.timelineRenderingType) {
        // Immediately set the focus, so if you start typing it
        // will appear in the composer
        composerElement.current?.focus();
        // If we call focus immediate, the focus _is_ in the right
        // place, but the cursor is invisible, presumably because
        // some other event is still processing.
        // The following line ensures that the cursor is actually
        // visible in composer.
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        timeoutId.current = setTimeout(
            () => composerElement.current?.focus(),
            200,
        );
    }
}
