/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useRef } from "react";
import { EmailSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td } from "../../../../languageHandler";
import EmailField from "../../../views/auth/EmailField";
import { ErrorMessage } from "../../ErrorMessage";
import Spinner from "../../../views/elements/Spinner";
import type Field from "../../../views/elements/Field";
import AccessibleButton, { type ButtonEvent } from "../../../views/elements/AccessibleButton";

interface EnterEmailProps {
    email: string;
    errorText: string | ReactNode | null;
    homeserver: string;
    loading: boolean;
    onInputChanged: (stateKey: "email", ev: React.FormEvent<HTMLInputElement>) => void;
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
    const submitButtonChild = loading ? <Spinner w={16} h={16} /> : _t("auth|forgot_password_send_email");

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
            <EmailSolidIcon className="mx_AuthBody_icon" />
            <h1>{_t("auth|enter_email_heading")}</h1>
            <p className="mx_AuthBody_text">
                {_t("auth|enter_email_explainer", { homeserver }, { b: (t) => <strong>{t}</strong> })}
            </p>
            <form onSubmit={onSubmit}>
                <fieldset disabled={loading}>
                    <div className="mx_AuthBody_fieldRow">
                        <EmailField
                            name="reset_email" // define a name so browser's password autofill gets less confused
                            label={_td("common|email_address")}
                            labelRequired={_td("auth|forgot_password_email_required")}
                            labelInvalid={_td("auth|forgot_password_email_invalid")}
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
                            {_t("auth|sign_in_instead")}
                        </AccessibleButton>
                    </div>
                </fieldset>
            </form>
        </>
    );
};
