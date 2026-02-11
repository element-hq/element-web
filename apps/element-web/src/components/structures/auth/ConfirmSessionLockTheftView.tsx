/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

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
                <p>{_t("error_app_opened_in_another_window", { brand, label: _t("action|continue") })}</p>

                <AccessibleButton kind="primary" onClick={props.onConfirm}>
                    {_t("action|continue")}
                </AccessibleButton>
            </div>
        </div>
    );
}
