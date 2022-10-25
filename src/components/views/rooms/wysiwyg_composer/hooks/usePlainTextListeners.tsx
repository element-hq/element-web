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

import { KeyboardEvent, SyntheticEvent, useCallback, useRef } from "react";

import { useInputEventProcessor } from "./useInputEventProcessor";

function isDivElement(target: EventTarget): target is HTMLDivElement {
    return target instanceof HTMLDivElement;
}

export function usePlainTextListeners(onChange: (content: string) => void, onSend: () => void) {
    const ref = useRef<HTMLDivElement>();
    const send = useCallback((() => {
        if (ref.current) {
            ref.current.innerText = '';
        }
        onSend();
    }), [ref, onSend]);

    const inputEventProcessor = useInputEventProcessor(send);

    const onInput = useCallback((event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>) => {
        if (isDivElement(event.target)) {
            onChange(event.target.innerText);
        }
        inputEventProcessor(event.nativeEvent);
    }, [onChange, inputEventProcessor]);

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            send();
        }
    }, [send]);

    return { ref, onInput, onPaste: onInput, onKeyDown };
}
