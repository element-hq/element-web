/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";
import { RestartIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../../views/elements/AccessibleButton";
import { Icon as EmailPromptIcon } from "../../../../../res/img/element-icons/email-prompt.svg";
import { useTimeoutToggle } from "../../../../hooks/useTimeoutToggle";
import { ErrorMessage } from "../../ErrorMessage";

interface Props {
    email: string;
    errorText: ReactNode | null;
    onFinished(): void; // This modal is weird in that the way you close it signals intent
    onCloseClick: () => void;
    onReEnterEmailClick: () => void;
    onResendClick: () => Promise<boolean>;
}

export const VerifyEmailModal: React.FC<Props> = ({
    email,
    errorText,
    onCloseClick,
    onReEnterEmailClick,
    onResendClick,
}) => {
    const { toggle: toggleTooltipVisible, value: tooltipVisible } = useTimeoutToggle(false, 2500);

    const onResendClickFn = async (): Promise<void> => {
        await onResendClick();
        toggleTooltipVisible();
    };

    return (
        <>
            <EmailPromptIcon className="mx_AuthBody_emailPromptIcon" />
            <h1>{_t("auth|verify_email_heading")}</h1>
            <p>
                {_t(
                    "auth|verify_email_explainer",
                    {
                        email,
                    },
                    {
                        b: (sub) => <strong>{sub}</strong>,
                    },
                )}
            </p>

            <div className="mx_AuthBody_did-not-receive">
                <span className="mx_VerifyEMailDialog_text-light">{_t("auth|check_email_resend_prompt")}</span>
                <Tooltip description={_t("auth|check_email_resend_tooltip")} placement="top" open={tooltipVisible}>
                    <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onResendClickFn}>
                        <RestartIcon className="mx_Icon mx_Icon_16" />
                        {_t("action|resend")}
                    </AccessibleButton>
                </Tooltip>
                {errorText && <ErrorMessage message={errorText} />}
            </div>

            <div className="mx_AuthBody_did-not-receive">
                <span className="mx_VerifyEMailDialog_text-light">{_t("auth|check_email_wrong_email_prompt")}</span>
                <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onReEnterEmailClick}>
                    {_t("auth|check_email_wrong_email_button")}
                </AccessibleButton>
            </div>

            <AccessibleButton
                onClick={onCloseClick}
                className="mx_Dialog_cancelButton"
                aria-label={_t("dialog_close_label")}
            />
        </>
    );
};
