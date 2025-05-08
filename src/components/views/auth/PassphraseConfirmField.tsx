/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, PureComponent, type Ref } from "react";

import Field, { type IInputProps } from "../elements/Field";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import { _t, _td, type TranslationKey } from "../../../languageHandler";

interface IProps extends Omit<IInputProps, "onValidate" | "label" | "element"> {
    id?: string;
    fieldRef?: Ref<Field>;
    autoComplete?: string;
    value: string;
    password: string; // The password we're confirming

    label: TranslationKey;
    labelRequired: TranslationKey;
    labelInvalid: TranslationKey;
    tooltipAlignment?: ComponentProps<typeof Field>["tooltipAlignment"];
    onChange(ev: React.FormEvent<HTMLElement>): void;
    onValidate?(result: IValidationResult): void;
}

class PassphraseConfirmField extends PureComponent<IProps> {
    public static defaultProps = {
        label: _td("auth|change_password_confirm_label"),
        labelRequired: _td("auth|change_password_confirm_label"),
        labelInvalid: _td("auth|change_password_confirm_invalid"),
    };

    private validate = withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t(this.props.labelRequired),
            },
            {
                key: "match",
                test: ({ value }) => !value || value === this.props.password,
                invalid: () => _t(this.props.labelInvalid),
            },
        ],
    });

    private onValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validate(fieldState);
        if (this.props.onValidate) {
            this.props.onValidate(result);
        }

        return result;
    };

    public render(): React.ReactNode {
        return (
            <Field
                id={this.props.id}
                ref={this.props.fieldRef}
                type="password"
                label={_t(this.props.label)}
                autoComplete={this.props.autoComplete}
                value={this.props.value}
                onChange={this.props.onChange}
                onValidate={this.onValidate}
                autoFocus={this.props.autoFocus}
                tooltipAlignment={this.props.tooltipAlignment}
            />
        );
    }
}

export default PassphraseConfirmField;
