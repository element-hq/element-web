/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React, { PropsWithChildren, useEffect, useState } from "react";
import { CryptoEvent, MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import { LocalDeviceVerificationStateContext } from "../../contexts/LocalDeviceVerificationStateContext";

/**
 * A React hook whose value is whether the local device has been "verified".
 *
 * Figuring out if we are verified is an async operation, so on the first render this always returns `false`, but
 * fires off a background job to update a state variable. It also registers an event listener to update the state
 * variable changes.
 *
 * @param client - Matrix client.
 * @returns A boolean which is `true` if the local device has been verified.
 *
 * @remarks
 *
 * Some notes on implementation.
 *
 * It turns out "is this device verified?" isn't a question that is easy to answer as you might think.
 *
 * Roughly speaking, it normally means "do we believe this device actually belongs to the person it claims to belong
 * to", and that data is available via `getDeviceVerificationStatus().isVerified()`. However, the problem is that for
 * the local device, that "do we believe..." question is trivially true, and `isVerified()` always returns true.
 *
 * Instead, when we're talking about the local device, what we really mean is one of:
 *  * "have we completed a verification dance (either interactive verification with a device with access to the
 *    cross-signing secrets, or typing in the 4S key)?", or
 *  * "will other devices consider this one to be verified?"
 *
 * (The first is generally required but not sufficient for the second to be true.)
 *
 * The second question basically amounts to "has this device been signed by our cross-signing key". So one option here
 * is to use `getDeviceVerificationStatus().isCrossSigningVerified()`. That might work, but it's a bit annoying because
 * it needs a `/keys/query` request to complete after the actual verification process completes.
 *
 * A slightly less rigorous check is just to find out if we have validated our own public cross-signing keys. If we
 * have, it's a good indication that we've at least completed a verification dance -- and hopefully, during that dance,
 * a cross-signature of our own device was published. And it's also easy to monitor via `UserTrustStatusChanged` events.
 *
 * Sooo: TL;DR: `getUserVerificationStatus()` is a good proxy for "is the local device verified?".
 */
function useLocalVerificationState(client: MatrixClient): boolean {
    const [value, setValue] = useState(false);

    // On the first render, initialise the state variable
    useEffect(() => {
        const userId = client.getUserId();
        if (!userId) return;
        const crypto = client.getCrypto();
        crypto?.getUserVerificationStatus(userId).then(
            (verificationStatus) => setValue(verificationStatus.isCrossSigningVerified()),
            (error) => logger.error("Error fetching verification status", error),
        );
    }, [client]);

    // Update the value whenever our own trust status changes.
    useEventEmitter(client, CryptoEvent.UserTrustStatusChanged, (userId, verificationStatus) => {
        if (userId === client.getUserId()) {
            setValue(verificationStatus.isCrossSigningVerified());
        }
    });

    return value;
}

interface Props {
    /** Matrix client, which is exposed to all child components via {@link MatrixClientContext}. */
    client: MatrixClient;
}

/**
 * A React component which exposes a {@link MatrixClientContext} and a {@link LocalDeviceVerificationStateContext}
 * to its children.
 */
export function MatrixClientContextProvider(props: PropsWithChildren<Props>): React.JSX.Element {
    const verificationState = useLocalVerificationState(props.client);
    return (
        <MatrixClientContext.Provider value={props.client}>
            <LocalDeviceVerificationStateContext.Provider value={verificationState}>
                {props.children}
            </LocalDeviceVerificationStateContext.Provider>
        </MatrixClientContext.Provider>
    );
}
