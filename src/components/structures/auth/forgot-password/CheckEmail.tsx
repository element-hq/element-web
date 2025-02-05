/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";
import { RestartIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import AccessibleButton from "../../../views/elements/AccessibleButton";
import { Icon as EMailPromptIcon } from "../../../../../res/img/element-icons/email-prompt.svg";
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
                <p>{_t("auth|check_email_explainer", { email: email }, { b: (t) => <strong>{t}</strong> })}</p>
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
                <Tooltip description={_t("auth|check_email_resend_tooltip")} placement="top" open={tooltipVisible}>
                    <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onResendClickFn}>
                        <RestartIcon className="mx_Icon mx_Icon_16" />
                        {_t("action|resend")}
                    </AccessibleButton>
                </Tooltip>
            </div>
        </>
    );
};
