/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import DialogButtons from "../elements/DialogButtons";
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";

export enum ButtonClicked {
    Primary,
    Cancel,
}

interface IProps {
    onFinished?(buttonClicked?: ButtonClicked): void;
    analyticsOwner: string;
    privacyPolicyUrl?: string;
    primaryButton?: string;
    cancelButton?: string;
    hasCancel?: boolean;
}

const AnalyticsLearnMoreDialog: React.FC<IProps> = ({
    onFinished,
    analyticsOwner,
    privacyPolicyUrl,
    primaryButton,
    cancelButton,
    hasCancel,
}) => {
    const onPrimaryButtonClick = () => onFinished && onFinished(ButtonClicked.Primary);
    const onCancelButtonClick = () => onFinished && onFinished(ButtonClicked.Cancel);
    const privacyPolicyLink = privacyPolicyUrl ?
        <span>
            {
                _t("You can read all our terms <PrivacyPolicyUrl>here</PrivacyPolicyUrl>", {}, {
                    "PrivacyPolicyUrl": (sub) => {
                        return <a href={privacyPolicyUrl}
                            rel="norefferer noopener"
                            target="_blank"
                        >
                            { sub }
                            <span className="mx_AnalyticsPolicyLink" />
                        </a>;
                    },
                })
            }
        </span> : "";
    return <BaseDialog
        className="mx_AnalyticsLearnMoreDialog"
        contentId="mx_AnalyticsLearnMore"
        title={_t("Help improve %(analyticsOwner)s", { analyticsOwner })}
        onFinished={onFinished}
    >
        <div className="mx_Dialog_content">
            <div className="mx_AnalyticsLearnMore_image_holder" />
            <div className="mx_AnalyticsLearnMore_copy">
                { _t("Help us identify issues and improve Element by sharing anonymous usage data. " +
                    "To understand how people use multiple devices, we'll generate a random identifier, " +
                    "shared by your devices.",
                ) }
            </div>
            <ul className="mx_AnalyticsLearnMore_bullets">
                <li>{ _t("We <Bold>don't</Bold> record or profile any account data",
                    {}, { "Bold": (sub) => <b>{ sub }</b> }) }</li>
                <li>{ _t("We <Bold>don't</Bold> share information with third parties",
                    {}, { "Bold": (sub) => <b>{ sub }</b> }) }</li>
                <li>{ _t("You can turn this off anytime in settings") }</li>
            </ul>
            { privacyPolicyLink }
        </div>
        <DialogButtons
            primaryButton={primaryButton}
            cancelButton={cancelButton}
            onPrimaryButtonClick={onPrimaryButtonClick}
            onCancel={onCancelButtonClick}
            hasCancel={hasCancel}
        />
    </BaseDialog>;
};

export const showDialog = (props: Omit<IProps, "cookiePolicyUrl" | "analyticsOwner">): void => {
    const privacyPolicyUrl = SdkConfig.get().piwik?.policyUrl;
    const analyticsOwner = SdkConfig.get().analyticsOwner ?? SdkConfig.get().brand;
    Modal.createTrackedDialog(
        "Analytics Learn More",
        "",
        AnalyticsLearnMoreDialog,
        { privacyPolicyUrl, analyticsOwner, ...props },
        "mx_AnalyticsLearnMoreDialog_wrapper",
    );
};

export default AnalyticsLearnMoreDialog;
