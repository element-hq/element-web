/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RefObject, useEffect } from "react";

export function usePlainTextInitialization(initialContent = "", ref: RefObject<HTMLElement>): void {
    useEffect(() => {
        // always read and write the ref.current using .innerHTML for consistency in linebreak and HTML entity handling
        if (ref.current) {
            ref.current.innerHTML = initialContent;
        }
    }, [ref, initialContent]);
}
