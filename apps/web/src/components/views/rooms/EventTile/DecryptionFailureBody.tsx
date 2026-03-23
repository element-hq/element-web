/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, type JSX } from "react";
import { DecryptionFailureBodyView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { LocalDeviceVerificationStateContext } from "../../../../contexts/LocalDeviceVerificationStateContext";
import { DecryptionFailureBodyViewModel } from "../../../../viewmodels/message-body/DecryptionFailureBodyViewModel";

type DecryptionFailureBodyProps = Readonly<{
    mxEvent: MatrixEvent;
}>;

export function DecryptionFailureBody({ mxEvent }: DecryptionFailureBodyProps): JSX.Element {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    const viewModel = useCreateAutoDisposedViewModel(
        () =>
            new DecryptionFailureBodyViewModel({
                decryptionFailureCode: mxEvent.decryptionFailureReason,
                verificationState,
            }),
    );

    useEffect(() => {
        viewModel.setVerificationState(verificationState);
    }, [verificationState, viewModel]);

    return <DecryptionFailureBodyView vm={viewModel} className="mx_DecryptionFailureBody mx_EventTile_content" />;
}
