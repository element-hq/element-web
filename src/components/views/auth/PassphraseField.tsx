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

import React, {PureComponent, RefCallback, RefObject} from "react";
import classNames from "classnames";
import zxcvbn from "zxcvbn";

import SdkConfig from "../../../SdkConfig";
import withValidation, {IFieldState, IValidationResult} from "../elements/Validation";
import {_t, _td} from "../../../languageHandler";
import Field from "../elements/Field";

interface IProps {
    autoFocus?: boolean;
    id?: string;
    className?: string;
    minScore: 0 | 1 | 2 | 3 | 4;
    value: string;
    fieldRef?: RefCallback<Field> | RefObject<Field>;

    label?: string;
    labelEnterPassword?: string;
    labelStrongPassword?: string;
    labelAllowedButUnsafe?: string;

    onChange(ev: KeyboardEvent);
    onValidate(result: IValidationResult);
}

interface IState {
    complexity: zxcvbn.ZXCVBNResult;
}

class PassphraseField extends PureComponent<IProps, IState> {
    static defaultProps = {
        label: _td("Password"),
        labelEnterPassword: _td("Enter password"),
        labelStrongPassword: _td("Nice, strong password!"),
        labelAllowedButUnsafe: _td("Password is allowed, but unsafe"),
    };

    state = { complexity: null };

    public readonly validate = withValidation<this>({
        description: function() {
            const complexity = this.state.complexity;
            const score = complexity ? complexity.score : 0;
            return <progress className="mx_PassphraseField_progress" max={4} value={score} />;
        },
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t(this.props.labelEnterPassword),
            },
            {
                key: "complexity",
                test: async function({ value }) {
                    if (!value) {
                        return false;
                    }
                    const { scorePassword } = await import('../../../utils/PasswordScorer');
                    const complexity = scorePassword(value);
                    this.setState({ complexity });
                    const safe = complexity.score >= this.props.minScore;
                    const allowUnsafe = SdkConfig.get()["dangerously_allow_unsafe_and_insecure_passwords"];
                    return allowUnsafe || safe;
                },
                valid: function() {
                    // Unsafe passwords that are valid are only possible through a
                    // configuration flag. We'll print some helper text to signal
                    // to the user that their password is allowed, but unsafe.
                    if (this.state.complexity.score >= this.props.minScore) {
                        return _t(this.props.labelStrongPassword);
                    }
                    return _t(this.props.labelAllowedButUnsafe);
                },
                invalid: function() {
                    const complexity = this.state.complexity;
                    if (!complexity) {
                        return null;
                    }
                    const { feedback } = complexity;
                    return feedback.warning || feedback.suggestions[0] || _t("Keep going...");
                },
            },
        ],
    });

    onValidate = async (fieldState: IFieldState) => {
        const result = await this.validate(fieldState);
        this.props.onValidate(result);
        return result;
    };

    render() {
        return <Field
            id={this.props.id}
            autoFocus={this.props.autoFocus}
            className={classNames("mx_PassphraseField", this.props.className)}
            ref={this.props.fieldRef}
            type="password"
            autoComplete="new-password"
            label={_t(this.props.label)}
            value={this.props.value}
            onChange={this.props.onChange}
            onValidate={this.onValidate}
        />
    }
}

export default PassphraseField;
