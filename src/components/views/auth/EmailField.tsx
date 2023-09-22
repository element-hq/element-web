/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { PureComponent, RefCallback, RefObject } from "react";

import Field, { IInputProps } from "../elements/Field";
import { _t, _td, TranslationKey } from "../../../languageHandler";
import withValidation, { IFieldState, IValidationResult } from "../elements/Validation";
import * as Email from "../../../email";

interface IProps extends Omit<IInputProps, "onValidate" | "element"> {
    id?: string;
    fieldRef?: RefCallback<Field> | RefObject<Field>;
    value: string;
    autoFocus?: boolean;

    label: TranslationKey;
    labelRequired: TranslationKey;
    labelInvalid: TranslationKey;

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
            />
        );
    }
}

export default EmailField;
