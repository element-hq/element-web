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

import { Icon as EmailIcon } from "../../../../../res/img/element-icons/Email-icon.svg";
import { _t, _td } from "../../../../languageHandler";
import EmailField from "../../../views/auth/EmailField";
import { ErrorMessage } from "../../ErrorMessage";
import Spinner from "../../../views/elements/Spinner";
import Field from "../../../views/elements/Field";
import AccessibleButton, { ButtonEvent } from "../../../views/elements/AccessibleButton";

interface EnterEmailProps {
    email: string;
    errorText: string | ReactNode | null;
    homeserver: string;
    loading: boolean;
    onInputChanged: (stateKey: string, ev: React.FormEvent<HTMLInputElement>) => void;
    onLoginClick: () => void;
    onSubmitForm: (ev: React.FormEvent) => void;
}

/**
 * This component renders the email input view of the forgot password flow.
 */
export const EnterEmail: React.FC<EnterEmailProps> = ({
    email,
    errorText,
    homeserver,
    loading,
    onInputChanged,
    onLoginClick,
    onSubmitForm,
}) => {
    const submitButtonChild = loading ? <Spinner w={16} h={16} /> : _t("Send email");

    const emailFieldRef = useRef<Field>(null);

    const onSubmit = async (event: React.FormEvent): Promise<void> => {
        if (await emailFieldRef.current?.validate({ allowEmpty: false })) {
            onSubmitForm(event);
            return;
        }

        emailFieldRef.current?.focus();
        emailFieldRef.current?.validate({ allowEmpty: false, focused: true });
    };

    return (
        <>
            <EmailIcon className="mx_AuthBody_icon" />
            <h1>{_t("Enter your email to reset password")}</h1>
            <p className="mx_AuthBody_text">
                {_t(
                    "<b>%(homeserver)s</b> will send you a verification link to let you reset your password.",
                    { homeserver },
                    { b: (t) => <b>{t}</b> },
                )}
            </p>
            <form onSubmit={onSubmit}>
                <fieldset disabled={loading}>
                    <div className="mx_AuthBody_fieldRow">
                        <EmailField
                            name="reset_email" // define a name so browser's password autofill gets less confused
                            label="Email address"
                            labelRequired={_td("The email address linked to your account must be entered.")}
                            labelInvalid={_td("The email address doesn't appear to be valid.")}
                            value={email}
                            autoFocus={true}
                            onChange={(event: React.FormEvent<HTMLInputElement>) => onInputChanged("email", event)}
                            fieldRef={emailFieldRef}
                        />
                    </div>
                    {errorText && <ErrorMessage message={errorText} />}
                    <button type="submit" className="mx_Login_submit">
                        {submitButtonChild}
                    </button>
                    <div className="mx_AuthBody_button-container">
                        <AccessibleButton
                            className="mx_AuthBody_sign-in-instead-button"
                            element="button"
                            kind="link"
                            onClick={(e: ButtonEvent) => {
                                e.preventDefault();
                                onLoginClick();
                            }}
                        >
                            {_t("Sign in instead")}
                        </AccessibleButton>
                    </div>
                </fieldset>
            </form>
        </>
    );
};
