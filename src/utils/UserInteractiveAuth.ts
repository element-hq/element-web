/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { AuthDict } from "matrix-js-sdk/src/interactive-auth";
import { UIAResponse } from "matrix-js-sdk/src/matrix";

import Modal from "../Modal";
import InteractiveAuthDialog, { InteractiveAuthDialogProps } from "../components/views/dialogs/InteractiveAuthDialog";

type FunctionWithUIA<R, A> = (auth?: AuthDict, ...args: A[]) => Promise<UIAResponse<R>>;

export function wrapRequestWithDialog<R, A = any>(
    requestFunction: FunctionWithUIA<R, A>,
    opts: Omit<InteractiveAuthDialogProps<R>, "makeRequest" | "onFinished">,
): (...args: A[]) => Promise<R> {
    return async function (...args): Promise<R> {
        return new Promise((resolve, reject) => {
            const boundFunction = requestFunction.bind(opts.matrixClient) as FunctionWithUIA<R, A>;
            boundFunction(undefined, ...args)
                .then((res) => resolve(res as R))
                .catch((error) => {
                    if (error.httpStatus !== 401 || !error.data?.flows) {
                        // doesn't look like an interactive-auth failure
                        return reject(error);
                    }

                    Modal.createDialog(InteractiveAuthDialog, {
                        ...opts,
                        authData: error.data,
                        makeRequest: (authData: AuthDict) => boundFunction(authData, ...args),
                        onFinished: (success, result) => {
                            if (success) {
                                resolve(result as R);
                            } else {
                                reject(result);
                            }
                        },
                    });
                });
        });
    };
}
