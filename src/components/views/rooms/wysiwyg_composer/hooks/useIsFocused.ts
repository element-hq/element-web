/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FocusEvent, useCallback, useEffect, useRef, useState } from "react";

export function useIsFocused(): {
    isFocused: boolean;
    onFocus(event: FocusEvent<HTMLElement>): void;
} {
    const [isFocused, setIsFocused] = useState(false);
    const timeoutIDRef = useRef<number>(undefined);

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
