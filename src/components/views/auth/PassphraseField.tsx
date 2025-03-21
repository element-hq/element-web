/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, PureComponent, type Ref } from "react";
import classNames from "classnames";

import type { ZxcvbnResult } from "@zxcvbn-ts/core";
import SdkConfig from "../../../SdkConfig";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import Field, { type IInputProps } from "../elements/Field";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps extends Omit<IInputProps, "onValidate" | "element"> {
    autoFocus?: boolean;
    id?: string;
    className?: string;
    minScore: 0 | 1 | 2 | 3 | 4;
    value: string;
    fieldRef?: Ref<Field>;
    // Additional strings such as a username used to catch bad passwords
    userInputs?: string[];

    label: TranslationKey;
    labelEnterPassword: TranslationKey;
    labelStrongPassword: TranslationKey;
    labelAllowedButUnsafe: TranslationKey;
    tooltipAlignment?: ComponentProps<typeof Field>["tooltipAlignment"];

    onChange(ev: React.FormEvent<HTMLElement>): void;
    onValidate?(result: IValidationResult): void;
}

class PassphraseField extends PureComponent<IProps> {
    public static defaultProps = {
        label: _td("common|password"),
        labelEnterPassword: _td("auth|password_field_label"),
        labelStrongPassword: _td("auth|password_field_strong_label"),
        labelAllowedButUnsafe: _td("auth|password_field_weak_label"),
    };

    public readonly validate = withValidation<this, ZxcvbnResult | null>({
        description: function (complexity) {
            const score = complexity ? complexity.score : 0;
            return <progress className="mx_PassphraseField_progress" max={4} value={score} />;
        },
        deriveData: async ({ value }): Promise<ZxcvbnResult | null> => {
            if (!value) return null;
            const { scorePassword } = await import("../../../utils/PasswordScorer");
            return scorePassword(MatrixClientPeg.get(), value, this.props.userInputs);
        },
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t(this.props.labelEnterPassword),
            },
            {
                key: "complexity",
                test: async function ({ value }, complexity): Promise<boolean> {
                    if (!value || !complexity) {
                        return false;
                    }
                    const safe = complexity.score >= this.props.minScore;
                    const allowUnsafe = SdkConfig.get("dangerously_allow_unsafe_and_insecure_passwords");
                    return allowUnsafe || safe;
                },
                valid: function (complexity) {
                    // Unsafe passwords that are valid are only possible through a
                    // configuration flag. We'll print some helper text to signal
                    // to the user that their password is allowed, but unsafe.
                    if (complexity && complexity.score >= this.props.minScore) {
                        return _t(this.props.labelStrongPassword);
                    }
                    return _t(this.props.labelAllowedButUnsafe);
                },
                invalid: function (complexity) {
                    if (!complexity) {
                        return null;
                    }
                    const { feedback } = complexity;
                    return feedback.warning || feedback.suggestions[0] || _t("auth|password_field_keep_going_prompt");
                },
            },
        ],
        memoize: true,
    });

    public onValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
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
                autoFocus={this.props.autoFocus}
                className={classNames("mx_PassphraseField", this.props.className)}
                ref={this.props.fieldRef}
                type="password"
                autoComplete="new-password"
                label={_t(this.props.label)}
                value={this.props.value}
                onChange={this.props.onChange}
                onValidate={this.onValidate}
                tooltipAlignment={this.props.tooltipAlignment}
            />
        );
    }
}

export default PassphraseField;
