/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { IAuthDict } from "matrix-js-sdk/src/interactive-auth";
import { UIAResponse } from "matrix-js-sdk/src/@types/uia";

import Modal from "../Modal";
import InteractiveAuthDialog, { InteractiveAuthDialogProps } from "../components/views/dialogs/InteractiveAuthDialog";

type FunctionWithUIA<R, A> = (auth?: IAuthDict | null, ...args: A[]) => Promise<UIAResponse<R>>;

export function wrapRequestWithDialog<R, A = any>(
    requestFunction: FunctionWithUIA<R, A>,
    opts: Omit<InteractiveAuthDialogProps<R>, "makeRequest" | "onFinished">,
): (...args: A[]) => Promise<R> {
    return async function (...args): Promise<R> {
        return new Promise((resolve, reject) => {
            const boundFunction = requestFunction.bind(opts.matrixClient) as FunctionWithUIA<R, A>;
            boundFunction(null, ...args)
                .then((res) => resolve(res as R))
                .catch((error) => {
                    if (error.httpStatus !== 401 || !error.data?.flows) {
                        // doesn't look like an interactive-auth failure
                        return reject(error);
                    }

                    Modal.createDialog(InteractiveAuthDialog, {
                        ...opts,
                        authData: error.data,
                        makeRequest: (authData: IAuthDict | null) => boundFunction(authData, ...args),
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
