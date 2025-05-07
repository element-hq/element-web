/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type SyntheticEvent, useRef, useState } from "react";

import { _t, _td } from "../../../languageHandler";
import type Field from "../elements/Field";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import EmailField from "../auth/EmailField";

interface IProps {
    onFinished(continued: false, email?: undefined): void;
    onFinished(continued: true, email: string): void;
}

const RegistrationEmailPromptDialog: React.FC<IProps> = ({ onFinished }) => {
    const [email, setEmail] = useState("");
    const fieldRef = useRef<Field>(null);

    const onSubmit = async (e: SyntheticEvent): Promise<void> => {
        e.preventDefault();
        if (!fieldRef.current) return;
        if (email) {
            const valid = await fieldRef.current.validate({});

            if (!valid) {
                fieldRef.current.focus();
                fieldRef.current.validate({ focused: true });
                return;
            }
        }

        onFinished(true, email);
    };

    return (
        <BaseDialog
            title={_t("auth|registration|continue_without_email_title")}
            className="mx_RegistrationEmailPromptDialog"
            contentId="mx_RegistrationEmailPromptDialog"
            onFinished={() => onFinished(false)}
            fixedWidth={false}
        >
            <div className="mx_Dialog_content" id="mx_RegistrationEmailPromptDialog">
                <p>
                    {_t(
                        "auth|registration|continue_without_email_description",
                        {},
                        {
                            b: (sub) => <strong>{sub}</strong>,
                        },
                    )}
                </p>
                <form onSubmit={onSubmit}>
                    <EmailField
                        fieldRef={fieldRef}
                        autoFocus={true}
                        label={_td("auth|registration|continue_without_email_field_label")}
                        value={email}
                        onChange={(ev) => {
                            const target = ev.target as HTMLInputElement;
                            setEmail(target.value);
                        }}
                    />
                </form>
            </div>
            <DialogButtons primaryButton={_t("action|continue")} onPrimaryButtonClick={onSubmit} hasCancel={false} />
        </BaseDialog>
    );
};

export default RegistrationEmailPromptDialog;
