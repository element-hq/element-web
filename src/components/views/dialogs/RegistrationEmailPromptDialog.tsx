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

import * as React from "react";
import { SyntheticEvent, useRef, useState } from "react";

import { _t, _td } from "../../../languageHandler";
import Field from "../elements/Field";
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
            title={_t("Continuing without email")}
            className="mx_RegistrationEmailPromptDialog"
            contentId="mx_RegistrationEmailPromptDialog"
            onFinished={() => onFinished(false)}
            fixedWidth={false}
        >
            <div className="mx_Dialog_content" id="mx_RegistrationEmailPromptDialog">
                <p>
                    {_t(
                        "Just a heads up, if you don't add an email and forget your password, you could " +
                            "<b>permanently lose access to your account</b>.",
                        {},
                        {
                            b: (sub) => <b>{sub}</b>,
                        },
                    )}
                </p>
                <form onSubmit={onSubmit}>
                    <EmailField
                        fieldRef={fieldRef}
                        autoFocus={true}
                        label={_td("Email (optional)")}
                        value={email}
                        onChange={(ev) => {
                            const target = ev.target as HTMLInputElement;
                            setEmail(target.value);
                        }}
                    />
                </form>
            </div>
            <DialogButtons primaryButton={_t("Continue")} onPrimaryButtonClick={onSubmit} hasCancel={false} />
        </BaseDialog>
    );
};

export default RegistrationEmailPromptDialog;
