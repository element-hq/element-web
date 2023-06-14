/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
        primaryButton: _t("Enable"),
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
        primaryButton: _t("That's fine"),
        cancelButton: _t("Stop"),
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
            description: _t(
                "You previously consented to share anonymous usage data with us. We're updating how that works.",
            ),
            acceptLabel: _t("That's fine"),
            onAccept,
            rejectLabel: _t("Learn more"),
            onReject: onLearnMorePreviouslyOptedIn,
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
            description: _t(
                "Share anonymous data to help us identify issues. Nothing personal. No third parties. " +
                    "<LearnMoreLink>Learn More</LearnMoreLink>",
                {},
                { LearnMoreLink: learnMoreLink },
            ),
            acceptLabel: _t("Yes"),
            onAccept,
            rejectLabel: _t("No"),
            onReject,
        };
    } else {
        // false
        // The user previously opted out of analytics, don't ask again
        return;
    }

    const analyticsOwner = SdkConfig.get("analytics_owner") ?? SdkConfig.get().brand;
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("Help improve %(analyticsOwner)s", { analyticsOwner }),
        props,
        component: GenericToast,
        className: "mx_AnalyticsToast",
        priority: 10,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
