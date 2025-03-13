/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import dis from "../dispatcher/dispatcher";
import AccessibleButton from "../components/views/elements/AccessibleButton";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import {
    ButtonClicked,
    showDialog as showAnalyticsLearnMoreDialog,
} from "../components/views/dialogs/AnalyticsLearnMoreDialog";
import { Action } from "../dispatcher/actions";
import SettingsStore from "../settings/SettingsStore";

const onAccept = (): void => {
    dis.dispatch({
        action: Action.PseudonymousAnalyticsAccept,
    });
};

const onReject = (): void => {
    dis.dispatch({
        action: Action.PseudonymousAnalyticsReject,
    });
};

const onLearnMoreNoOptIn = (): void => {
    showAnalyticsLearnMoreDialog({
        onFinished: (buttonClicked?: ButtonClicked) => {
            if (buttonClicked === ButtonClicked.Primary) {
                // user clicked "Enable"
                onAccept();
            }
            // otherwise, the user either clicked "Cancel", or closed the dialog without making a choice,
            // leave the toast open
        },
        primaryButton: _t("action|enable"),
    });
};

const onLearnMorePreviouslyOptedIn = (): void => {
    showAnalyticsLearnMoreDialog({
        onFinished: (buttonClicked?: ButtonClicked) => {
            if (buttonClicked === ButtonClicked.Primary) {
                // user clicked "That's fine"
                onAccept();
            } else if (buttonClicked === ButtonClicked.Cancel) {
                // user clicked "Stop"
                onReject();
            }
            // otherwise, the user closed the dialog without making a choice, leave the toast open
        },
        primaryButton: _t("analytics|accept_button"),
        cancelButton: _t("action|stop"),
    });
};

const TOAST_KEY = "analytics";

export function getPolicyUrl(): string | undefined {
    return SdkConfig.get("privacy_policy_url");
}

export const showToast = (): void => {
    const legacyAnalyticsOptIn = SettingsStore.getValue("analyticsOptIn", null, true);

    let props: Omit<React.ComponentProps<typeof GenericToast>, "toastKey">;
    if (legacyAnalyticsOptIn) {
        // The user previously opted into our old analytics system - let them know things have changed and ask
        // them to opt in again.
        props = {
            description: _t("analytics|consent_migration"),
            primaryLabel: _t("analytics|accept_button"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|learn_more"),
            onSecondaryClick: onLearnMorePreviouslyOptedIn,
        };
    } else if (legacyAnalyticsOptIn === null || legacyAnalyticsOptIn === undefined) {
        // The user had no analytics setting previously set, so we just need to prompt to opt-in, rather than
        // explaining any change.
        const learnMoreLink = (sub: string): JSX.Element => (
            <AccessibleButton kind="link_inline" onClick={onLearnMoreNoOptIn}>
                {sub}
            </AccessibleButton>
        );
        props = {
            description: _t("analytics|learn_more", {}, { LearnMoreLink: learnMoreLink }),
            primaryLabel: _t("action|yes"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|no"),
            onSecondaryClick: onReject,
        };
    } else {
        // false
        // The user previously opted out of analytics, don't ask again
        return;
    }

    const analyticsOwner = SdkConfig.get("analytics_owner") ?? SdkConfig.get().brand;
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("analytics|enable_prompt", { analyticsOwner }),
        props,
        component: GenericToast,
        className: "mx_AnalyticsToast",
        priority: 10,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
