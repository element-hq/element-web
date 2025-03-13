/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t, _td } from "../languageHandler";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import { messageForResourceLimitError } from "../utils/ErrorUtils";

const TOAST_KEY = "serverlimit";

export const showToast = (
    limitType: string,
    onHideToast: () => void,
    adminContact?: string,
    syncError?: boolean,
): void => {
    const errorText = messageForResourceLimitError(limitType, adminContact, {
        "monthly_active_user": _td("error|mau"),
        "hs_blocked": _td("error|hs_blocked"),
        "": _td("error|resource_limits"),
    });
    const contactText = messageForResourceLimitError(limitType, adminContact, {
        "": _td("error|admin_contact_short"),
    });

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("common|warning"),
        props: {
            description: (
                <React.Fragment>
                    {errorText} {contactText}
                </React.Fragment>
            ),
            primaryLabel: _t("action|ok"),
            onPrimaryClick: () => {
                hideToast();
                if (onHideToast) onHideToast();
            },
        },
        component: GenericToast,
        priority: 70,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
