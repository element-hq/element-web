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

import React, { ReactNode, useRef } from "react";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../../views/elements/AccessibleButton";
import { Icon as RetryIcon } from "../../../../../res/img/compound/retry-16px.svg";
import { Icon as EmailPromptIcon } from "../../../../../res/img/element-icons/email-prompt.svg";
import Tooltip, { Alignment } from "../../../views/elements/Tooltip";
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
    const tooltipId = useRef(`mx_VerifyEmailModal_${Math.random()}`).current;
    const { toggle: toggleTooltipVisible, value: tooltipVisible } = useTimeoutToggle(false, 2500);

    const onResendClickFn = async (): Promise<void> => {
        await onResendClick();
        toggleTooltipVisible();
    };

    return (
        <>
            <EmailPromptIcon className="mx_AuthBody_emailPromptIcon" />
            <h1>{_t("Verify your email to continue")}</h1>
            <p>
                {_t(
                    "We need to know it’s you before resetting your password. " +
                        "Click the link in the email we just sent to <b>%(email)s</b>",
                    {
                        email,
                    },
                    {
                        b: (sub) => <b>{sub}</b>,
                    },
                )}
            </p>

            <div className="mx_AuthBody_did-not-receive">
                <span className="mx_VerifyEMailDialog_text-light">{_t("Did not receive it?")}</span>
                <AccessibleButton
                    className="mx_AuthBody_resend-button"
                    kind="link"
                    onClick={onResendClickFn}
                    aria-describedby={tooltipVisible ? tooltipId : undefined}
                >
                    <RetryIcon className="mx_Icon mx_Icon_16" />
                    {_t("Resend")}
                    <Tooltip
                        id={tooltipId}
                        label={_t("Verification link email resent!")}
                        alignment={Alignment.Top}
                        visible={tooltipVisible}
                    />
                </AccessibleButton>
                {errorText && <ErrorMessage message={errorText} />}
            </div>

            <div className="mx_AuthBody_did-not-receive">
                <span className="mx_VerifyEMailDialog_text-light">{_t("Wrong email address?")}</span>
                <AccessibleButton className="mx_AuthBody_resend-button" kind="link" onClick={onReEnterEmailClick}>
                    {_t("Re-enter email address")}
                </AccessibleButton>
            </div>

            <AccessibleButton
                onClick={onCloseClick}
                className="mx_Dialog_cancelButton"
                aria-label={_t("Close dialog")}
            />
        </>
    );
};
