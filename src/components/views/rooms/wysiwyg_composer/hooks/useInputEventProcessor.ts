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

import { WysiwygEvent } from "@matrix-org/matrix-wysiwyg";
import { useCallback } from "react";

import { useSettingValue } from "../../../../../hooks/useSettings";

function isEnterPressed(event: KeyboardEvent): boolean {
    // Ugly but here we need to send the message only if Enter is pressed
    // And we need to stop the event propagation on enter to avoid the composer to grow
    return event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function useInputEventProcessor(onSend: () => void): (event: WysiwygEvent) => WysiwygEvent | null {
    const isCtrlEnter = useSettingValue<boolean>("MessageComposerInput.ctrlEnterToSend");
    return useCallback(
        (event: WysiwygEvent) => {
            if (event instanceof ClipboardEvent) {
                return event;
            }

            const isKeyboardEvent = event instanceof KeyboardEvent;
            const isEnterPress = !isCtrlEnter && isKeyboardEvent && isEnterPressed(event);
            const isInsertParagraph = !isCtrlEnter && !isKeyboardEvent && event.inputType === "insertParagraph";
            // sendMessage is sent when cmd+enter is pressed
            const isSendMessage = isCtrlEnter && !isKeyboardEvent && event.inputType === "sendMessage";

            if (isEnterPress || isInsertParagraph || isSendMessage) {
                event.stopPropagation?.();
                event.preventDefault?.();
                onSend();
                return null;
            }

            return event;
        },
        [isCtrlEnter, onSend],
    );
}
