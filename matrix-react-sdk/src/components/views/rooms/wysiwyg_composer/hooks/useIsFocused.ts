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

import { FocusEvent, useCallback, useEffect, useRef, useState } from "react";

export function useIsFocused(): {
    isFocused: boolean;
    onFocus(event: FocusEvent<HTMLElement>): void;
} {
    const [isFocused, setIsFocused] = useState(false);
    const timeoutIDRef = useRef<number>();

    useEffect(() => () => clearTimeout(timeoutIDRef.current), [timeoutIDRef]);
    const onFocus = useCallback(
        (event: FocusEvent<HTMLElement>) => {
            clearTimeout(timeoutIDRef.current);
            if (event.type === "focus") {
                setIsFocused(true);
            } else {
                // To avoid a blink when we switch mode between plain text and rich text mode
                // We delay the unfocused action
                timeoutIDRef.current = window.setTimeout(() => setIsFocused(false), 100);
            }
        },
        [setIsFocused, timeoutIDRef],
    );

    return { isFocused, onFocus };
}
