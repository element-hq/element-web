/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Is dehydration supported on our homeserver?
 *
 * Value returned is undefined until we have finished checking, and then true if
 * dehydration is supported, false otherwise.
 */
export const useDehydrationSupported = (matrixClient: MatrixClient): boolean | undefined => {
    const [isDehydrationSupported, setDehydrationSupported] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        void matrixClient
            .getCrypto()
            ?.isDehydrationSupported()
            .then((value) => setDehydrationSupported(value));
    }, [matrixClient]);

    return isDehydrationSupported;
};
