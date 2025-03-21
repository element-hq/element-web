/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, PureComponent, type Ref } from "react";

import Field, { type IInputProps } from "../elements/Field";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import * as Email from "../../../email";

interface IProps extends Omit<IInputProps, "onValidate" | "element"> {
    id?: string;
    fieldRef?: Ref<Field>;
    value: string;
    autoFocus?: boolean;

    label: TranslationKey;
    labelRequired: TranslationKey;
    labelInvalid: TranslationKey;
    tooltipAlignment?: ComponentProps<typeof Field>["tooltipAlignment"];

    // When present, completely overrides the default validation rules.
    validationRules?: (fieldState: IFieldState) => Promise<IValidationResult>;

    onChange(ev: React.FormEvent<HTMLElement>): void;
    onValidate?(result: IValidationResult): void;
}

class EmailField extends PureComponent<IProps> {
    public static defaultProps = {
        label: _td("auth|email_field_label"),
        labelRequired: _td("auth|email_field_label_required"),
        labelInvalid: _td("auth|email_field_label_invalid"),
    };

    public readonly validate = withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t(this.props.labelRequired),
            },
            {
                key: "email",
                test: ({ value }) => !value || Email.looksValid(value),
                invalid: () => _t(this.props.labelInvalid),
            },
        ],
    });

    public onValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        let validate = this.validate;
        if (this.props.validationRules) {
            validate = this.props.validationRules;
        }

        const result = await validate(fieldState);
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
                type="text"
                label={_t(this.props.label)}
                value={this.props.value}
                autoFocus={this.props.autoFocus}
                onChange={this.props.onChange}
                onValidate={this.onValidate}
                tooltipAlignment={this.props.tooltipAlignment}
            />
        );
    }
}

export default EmailField;
