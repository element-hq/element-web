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
import withValidation, { IFieldState, IValidationResult } from "../elements/Validation";
import { _t, _td } from "../../../languageHandler";

interface IProps extends Omit<IInputProps, "onValidate" | "label" | "element"> {
    id?: string;
    fieldRef?: RefCallback<Field> | RefObject<Field>;
    autoComplete?: string;
    value: string;
    password: string; // The password we're confirming

    label: string;
    labelRequired: string;
    labelInvalid: string;

    onChange(ev: React.FormEvent<HTMLElement>): void;
    onValidate?(result: IValidationResult): void;
}

class PassphraseConfirmField extends PureComponent<IProps> {
    public static defaultProps = {
        label: _td("Confirm password"),
        labelRequired: _td("Confirm password"),
        labelInvalid: _td("Passwords don't match"),
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
            />
        );
    }
}

export default PassphraseConfirmField;
