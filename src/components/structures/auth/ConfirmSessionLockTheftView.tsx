/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import AccessibleButton from "../../views/elements/AccessibleButton";

interface Props {
    /** Callback which the view will call if the user confirms they want to use this window */
    onConfirm: () => void;
}

/**
 * Component shown by {@link MatrixChat} when another session is already active in the same browser and we need to
 * confirm if we should steal its lock
 */
export function ConfirmSessionLockTheftView(props: Props): JSX.Element {
    const brand = SdkConfig.get().brand;

    return (
        <div className="mx_ConfirmSessionLockTheftView">
            <div className="mx_ConfirmSessionLockTheftView_body">
                <p>
                    {_t(
                        '%(brand)s is open in another window. Click "%(label)s" to use %(brand)s here and disconnect the other window.',
                        { brand, label: _t("action|continue") },
                    )}
                </p>

                <AccessibleButton kind="primary" onClick={props.onConfirm}>
                    {_t("action|continue")}
                </AccessibleButton>
            </div>
        </div>
    );
}
