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

import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { IRoomState } from "../../../../structures/RoomView";

export function focusComposer(
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

export function setCursorPositionAtTheEnd(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    element.focus();
}
