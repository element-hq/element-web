/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useMemo, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MediaEventHelper } from "../../../../utils/MediaEventHelper";

export interface MediaBytes {
    /** The file contents, or `null` while still being fetched. */
    data: ArrayBuffer | null;
    /** Set if the media could not be fetched or decrypted. */
    error: unknown;
    /** The helper backing this fetch, for callers that need the filename or source URL. */
    helper: MediaEventHelper;
}

/**
 * Fetch (and, in encrypted rooms, decrypt) an attachment as raw bytes.
 *
 * The document previewers parse bytes directly rather than pointing an `<iframe>` or `<embed>` at
 * a blob URL. That is deliberate: a same-origin blob URL of user-supplied content is the XSS
 * vector that `utils/blobs.ts` exists to prevent, and our CSP sets no `object-src` anyway.
 *
 * @param mxEvent - the media event to load
 */
export function useMediaBytes(mxEvent: MatrixEvent): MediaBytes {
    const helper = useMemo(() => new MediaEventHelper(mxEvent), [mxEvent]);
    const [data, setData] = useState<ArrayBuffer | null>(null);
    const [error, setError] = useState<unknown>(null);

    useEffect(() => () => helper.destroy(), [helper]);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);

        helper.sourceBlob.value
            .then((blob) => blob.arrayBuffer())
            .then((buffer) => {
                if (!cancelled) setData(buffer);
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to fetch attachment for preview", err);
                setError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [helper]);

    return { data, error, helper };
}
