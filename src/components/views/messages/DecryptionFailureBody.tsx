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

import React, { forwardRef, ForwardRefExoticComponent } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { IBodyProps } from "./IBodyProps";

function getErrorMessage(mxEvent?: MatrixEvent): string {
    return mxEvent?.isEncryptedDisabledForUnverifiedDevices
        ? _t("timeline|decryption_failure_blocked")
        : _t("threads|unable_to_decrypt");
}

// A placeholder element for messages that could not be decrypted
export const DecryptionFailureBody = forwardRef<HTMLDivElement, IBodyProps>(({ mxEvent }, ref): JSX.Element => {
    return (
        <div className="mx_DecryptionFailureBody mx_EventTile_content" ref={ref}>
            {getErrorMessage(mxEvent)}
        </div>
    );
}) as ForwardRefExoticComponent<IBodyProps>;
