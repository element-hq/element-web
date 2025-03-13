/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MutableRefObject, useEffect, useState } from "react";

export function useIsExpanded(ref: MutableRefObject<HTMLElement | null>, breakingPoint: number): boolean {
    const [isExpanded, setIsExpanded] = useState(false);
    useEffect(() => {
        if (ref.current) {
            const editor = ref.current;
            const resizeObserver = new ResizeObserver((entries) => {
                requestAnimationFrame(() => {
                    const height = entries[0]?.contentBoxSize?.[0].blockSize;
                    setIsExpanded(height >= breakingPoint);
                });
            });

            resizeObserver.observe(editor);
            return () => resizeObserver.unobserve(editor);
        }
    }, [ref, breakingPoint]);

    return isExpanded;
}
