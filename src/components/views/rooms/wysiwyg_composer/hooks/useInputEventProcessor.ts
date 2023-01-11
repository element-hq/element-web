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

export function useInputEventProcessor(onSend: () => void) {
    const isCtrlEnter = useSettingValue<boolean>("MessageComposerInput.ctrlEnterToSend");
    return useCallback(
        (event: WysiwygEvent) => {
            if (event instanceof ClipboardEvent) {
                return event;
            }

            const isKeyboardEvent = event instanceof KeyboardEvent;
            const isEnterPress =
                !isCtrlEnter && (isKeyboardEvent ? event.key === "Enter" : event.inputType === "insertParagraph");
            // sendMessage is sent when ctrl+enter is pressed
            const isSendMessage = !isKeyboardEvent && event.inputType === "sendMessage";

            if (isEnterPress || isSendMessage) {
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
