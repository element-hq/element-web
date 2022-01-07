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

import React, { ReactNode } from "react";

import { _t } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import dis from "../dispatcher/dispatcher";
import Analytics from "../Analytics";
import AccessibleButton from "../components/views/elements/AccessibleButton";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import {
    ButtonClicked,
    showDialog as showAnalyticsLearnMoreDialog,
} from "../components/views/dialogs/AnalyticsLearnMoreDialog";
import { Action } from "../dispatcher/actions";

const onAccept = () => {
    dis.dispatch({
        action: Action.PseudonymousAnalyticsAccept,
    });
};

const onReject = () => {
    dis.dispatch({
        action: Action.PseudonymousAnalyticsReject,
    });
};

const onLearnMoreNoOptIn = () => {
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

const onLearnMorePreviouslyOptedIn = () => {
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

const onUsageDataClicked = () => {
    Analytics.showDetailsModal();
};

const TOAST_KEY = "analytics";

const getAnonymousDescription = (): ReactNode => {
    // get toast description for anonymous tracking (the previous scheme pre-posthog)
    const brand = SdkConfig.get().brand;
    const cookiePolicyUrl = SdkConfig.get().piwik?.policyUrl;
    return _t(
        "Send <UsageDataLink>anonymous usage data</UsageDataLink> which helps us improve %(brand)s. " +
        "This will use a <PolicyLink>cookie</PolicyLink>.",
        {
            brand,
        },
        {
            "UsageDataLink": (sub) => (
                <AccessibleButton kind="link" onClick={onUsageDataClicked}>{ sub }</AccessibleButton>
            ),
            "PolicyLink": (sub) => cookiePolicyUrl ? (
                <a target="_blank" href={cookiePolicyUrl}>{ sub }</a>
            ) : sub,
        },
    );
};

const showToast = (props: Omit<React.ComponentProps<typeof GenericToast>, "toastKey">) => {
    const analyticsOwner = SdkConfig.get().analyticsOwner ?? SdkConfig.get().brand;
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("Help improve %(analyticsOwner)s", { analyticsOwner }),
        props,
        component: GenericToast,
        className: "mx_AnalyticsToast",
        priority: 10,
    });
};

export const showPseudonymousAnalyticsOptInToast = (analyticsOptIn: boolean): void => {
    let props;
    if (analyticsOptIn) {
        // The user previously opted into our old analytics system - let them know things have changed and ask
        // them to opt in again.
        props = {
            description: _t(
                "You previously consented to share anonymous usage data with us. We're updating how that works."),
            acceptLabel: _t("That's fine"),
            onAccept,
            rejectLabel: _t("Learn more"),
            onReject: onLearnMorePreviouslyOptedIn,
        };
    } else if (analyticsOptIn === null || analyticsOptIn === undefined) {
        // The user had no analytics setting previously set, so we just need to prompt to opt-in, rather than
        // explaining any change.
        const learnMoreLink = (sub) => (
            <AccessibleButton kind="link" onClick={onLearnMoreNoOptIn}>{ sub }</AccessibleButton>
        );
        props = {
            description: _t(
                "Share anonymous data to help us identify issues. Nothing personal. No third parties. " +
                "<LearnMoreLink>Learn More</LearnMoreLink>", {}, { "LearnMoreLink": learnMoreLink }),
            acceptLabel: _t("Yes"),
            onAccept,
            rejectLabel: _t("No"),
            onReject,
        };
    } else { // false
        // The user previously opted out of analytics, don't ask again
        return;
    }
    showToast(props);
};

export const showAnonymousAnalyticsOptInToast = (): void => {
    const props = {
        description: getAnonymousDescription(),
        acceptLabel: _t("Yes"),
        onAccept: () => dis.dispatch({
            action: Action.AnonymousAnalyticsAccept,
        }),
        rejectLabel: _t("No"),
        onReject: () => dis.dispatch({
            action: Action.AnonymousAnalyticsReject,
        }),
    };
    showToast(props);
};

export const hideToast = () => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
