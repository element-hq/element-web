/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useDebouncedCallback } from "../../../hooks/spotlight/useDebouncedCallback";
import { debounce } from "lodash";

export function MessageComposorUrlPreview({ content }: { content: string }): ReactNode | null {
    const debounceFn = useRef(debounce((c: string) => c.split(" ").filter((word) => URL.canParse(word.trim())), 1500));

    const determineLinks = useMemo(() => debounceFn.current(content), [content]);

    return (
        <div>
            <b>{determineLinks}</b>
        </div>
    );
}
