/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useRef, type RefObject, type KeyboardEvent, type KeyboardEventHandler } from "react";

/**
 * A hook that provides keyboard navigation for a list of options.
 */
export function useListKeyDown(): {
    listRef: RefObject<HTMLUListElement | null>;
    onKeyDown: KeyboardEventHandler<HTMLUListElement>;
} {
    const listRef = useRef<HTMLUListElement>(null);

    const onKeyDown = useCallback((evt: KeyboardEvent<HTMLUListElement>) => {
        const { key } = evt;

        let handled = false;

        switch (key) {
            case "Enter":
            case " ": {
                handled = true;
                (document.activeElement as HTMLElement).click();
                break;
            }
            case "ArrowDown": {
                handled = true;
                const currentFocus = document.activeElement;
                if (listRef.current?.contains(currentFocus) && currentFocus) {
                    (currentFocus.nextElementSibling as HTMLElement)?.focus();
                }
                break;
            }
            case "ArrowUp": {
                handled = true;
                const currentFocus = document.activeElement;
                if (listRef.current?.contains(currentFocus) && currentFocus) {
                    (currentFocus.previousElementSibling as HTMLElement)?.focus();
                }
                break;
            }
            case "Home": {
                handled = true;
                (listRef.current?.firstElementChild as HTMLElement)?.focus();
                break;
            }
            case "End": {
                handled = true;
                (listRef.current?.lastElementChild as HTMLElement)?.focus();
                break;
            }
        }

        if (handled) {
            evt.preventDefault();
        }
    }, []);
    return { listRef, onKeyDown };
}
