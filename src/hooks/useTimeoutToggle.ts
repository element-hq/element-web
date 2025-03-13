/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useRef, useState } from "react";

/**
 * Hook that allows toggling a boolean value and resets it after a timeout.
 *
 * @param {boolean} defaultValue Default value
 * @param {number} timeoutMs Time after that the value will be reset
 */
export const useTimeoutToggle = (
    defaultValue: boolean,
    timeoutMs: number,
): {
    value: boolean;
    toggle(): void;
} => {
    const timeoutId = useRef<number | undefined>();
    const [value, setValue] = useState<boolean>(defaultValue);

    const toggle = (): void => {
        setValue(!defaultValue);
        timeoutId.current = window.setTimeout(() => setValue(defaultValue), timeoutMs);
    };

    useEffect(() => {
        return () => {
            clearTimeout(timeoutId.current);
        };
    });

    return {
        toggle,
        value,
    };
};
