/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext, useEffect, useState } from "react";

import { _t } from "../../../languageHandler";
import { SDKContext } from "../../../contexts/SDKContext";

/**
 * Is dehydration supported on our homeserver?
 *
 * Value returned is undefined until we have finished checking, and then true if
 * dehydration is supported, false otherwise.
 */
export const useDehydrationSupported = (): boolean | undefined => {
    const sdkContext = useContext(SDKContext);
    const matrixClient = sdkContext.client!;

    const [isDehydrationSupported, setDehydrationSupported] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        matrixClient
            .getCrypto()
            ?.isDehydrationSupported()
            .then((value) => setDehydrationSupported(value));
    }, [matrixClient]);

    return isDehydrationSupported;
};
