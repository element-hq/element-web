/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../languageHandler";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import SdkConfig from "../SdkConfig";

const onAccept = (): void => {
    window.location.href = "mobile_guide/";
};

const onReject = (): void => {
    document.cookie = "element_mobile_redirect_to_guide=false;path=/;max-age=14400";
    hideToast();
};

const TOAST_KEY = "mobileguide";

export const showToast = (): void => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const brand = SdkConfig.get().brand;
    if (!isIos && !isAndroid) {
        return;
    }
    if (document.cookie.includes("element_mobile_redirect_to_guide=false")) {
        return;
    }
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("mobile_guide|toast_title"),
        props: {
            description: _t("mobile_guide|toast_description", { brand }),
            primaryLabel: _t("mobile_guide|toast_accept"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: onReject,
        },
        component: GenericToast,
        priority: 99,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
