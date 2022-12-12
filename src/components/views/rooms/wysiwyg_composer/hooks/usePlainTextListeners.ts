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

import { KeyboardEvent, SyntheticEvent, useCallback, useRef, useState } from "react";

import { useSettingValue } from "../../../../../hooks/useSettings";

function isDivElement(target: EventTarget): target is HTMLDivElement {
    return target instanceof HTMLDivElement;
}

export function usePlainTextListeners(
    initialContent?: string,
    onChange?: (content: string) => void,
    onSend?: () => void,
) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [content, setContent] = useState<string | undefined>(initialContent);
    const send = useCallback(() => {
        if (ref.current) {
            ref.current.innerHTML = "";
        }
        onSend?.();
    }, [ref, onSend]);

    const setText = useCallback(
        (text: string) => {
            setContent(text);
            onChange?.(text);
        },
        [onChange],
    );

    const onInput = useCallback(
        (event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>) => {
            if (isDivElement(event.target)) {
                setText(event.target.innerHTML);
            }
        },
        [setText],
    );

    const isCtrlEnter = useSettingValue<boolean>("MessageComposerInput.ctrlEnterToSend");
    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" && !event.shiftKey && (!isCtrlEnter || (isCtrlEnter && event.ctrlKey))) {
                event.preventDefault();
                event.stopPropagation();
                send();
            }
        },
        [isCtrlEnter, send],
    );

    return { ref, onInput, onPaste: onInput, onKeyDown, content, setContent: setText };
}
