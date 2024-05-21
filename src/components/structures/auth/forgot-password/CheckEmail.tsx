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

import React, { ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";

import AccessibleButton from "../../../views/elements/AccessibleButton";
import { Icon as EMailPromptIcon } from "../../../../../res/img/element-icons/email-prompt.svg";
import { Icon as RetryIcon } from "../../../../../res/img/compound/retry-16px.svg";
import { _t } from "../../../../languageHandler";
import { useTimeoutToggle } from "../../../../hooks/useTimeoutToggle";
import { ErrorMessage } from "../../ErrorMessage";

interface CheckEmailProps {
    email: string;
    errorText: string | ReactNode | null;
    onReEnterEmailClick: () => void;
    onResendClick: () => Promise<boolean>;
    onSubmitForm: (ev: React.FormEvent) => void;
}

/**
 * This component renders the email verification view of the forgot password flow.
 */
export const CheckEmail: React.FC<CheckEmailProps> = ({
    email,
    errorText,
    onReEnterEmailClick,
    onSubmitForm,
    onResendClick,
}) => {
    const { toggle: toggleTooltipVisible, value: tooltipVisible } = useTimeoutToggle(false, 2500);

    const onResendClickFn = async (): Promise<void> => {
        await onResendClick();
        toggleTooltipVisible();
    };

    return (
        <>
            <EMailPromptIcon className="mx_AuthBody_emailPromptIcon--shifted" />
            <h1>{_t("auth|uia|email_auth_header")}</h1>
            <div className="mx_AuthBody_text">
                <p>{_t("auth|check_email_explainer", { email: email }, { b: (t) => <b>{t}</b> })}</p>
                <div className="mx_AuthBody_did-not-receive">
                    <span className="mx_VerifyEMailDialog_text-light">{_t("auth|check_email_wrong_email_prompt")}</span>
                    <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onReEnterEmailClick}>
                        {_t("auth|check_email_wrong_email_button")}
                    </AccessibleButton>
                </div>
            </div>
            {errorText && <ErrorMessage message={errorText} />}
            <input onClick={onSubmitForm} type="button" className="mx_Login_submit" value={_t("action|next")} />
            <div className="mx_AuthBody_did-not-receive">
                <span className="mx_VerifyEMailDialog_text-light">{_t("auth|check_email_resend_prompt")}</span>
                <Tooltip label={_t("auth|check_email_resend_tooltip")} placement="top" open={tooltipVisible}>
                    <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onResendClickFn}>
                        <RetryIcon className="mx_Icon mx_Icon_16" />
                        {_t("action|resend")}
                    </AccessibleButton>
                </Tooltip>
            </div>
        </>
    );
};
