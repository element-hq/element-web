/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefCallback, type RefObject, useCallback, useMemo, useState } from "react";
import classNames from "classnames";

import type { Score, ZxcvbnResult } from "@zxcvbn-ts/core";
import SdkConfig from "../../../SdkConfig";
import withValidation, { type IValidationResult } from "../elements/Validation";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import { type IInputProps } from "../elements/Field";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { Field, Label, PasswordInput, Progress } from "@vector-im/compound-web";

const SCORE_TINT: Record<Score, "red" | "orange" | "lime" | "green"> ={
    "0": "red",
    "1": "red",
    "2": "orange",
    "3": "lime",
    "4": "green"
};

interface IProps extends Omit<IInputProps, "onValidate" | "element"> {
    autoFocus?: boolean;
    id?: string;
    className?: string;
    minScore: 0 | 1 | 2 | 3 | 4;
    value: string;
    fieldRef?: RefCallback<HTMLInputElement> | RefObject<HTMLInputElement>;
    // Additional strings such as a username used to catch bad passwords
    userInputs?: string[];

    label: TranslationKey;
    labelEnterPassword?: TranslationKey;
    labelStrongPassword?: TranslationKey;
    labelAllowedButUnsafe?: TranslationKey;
    // tooltipAlignment?: ComponentProps<typeof Field>["tooltipAlignment"];

    onChange(ev: React.FormEvent<HTMLElement>): void;
    onValidate?(result: IValidationResult): void;
}

const DEFAULT_PROPS = {
    label: _td("common|password"),
    labelEnterPassword: _td("auth|password_field_label"),
    labelStrongPassword: _td("auth|password_field_strong_label"),
    labelAllowedButUnsafe: _td("auth|password_field_weak_label"),
};

const NewPassphraseField: React.FC<IProps> = (props) => {
    const { labelEnterPassword, userInputs, minScore, label, labelStrongPassword, labelAllowedButUnsafe, className, id, fieldRef, autoFocus} = {...DEFAULT_PROPS, ...props};
    const validateFn = useMemo(() => withValidation<{}, ZxcvbnResult | null>({
        description: function (complexity) {
            const score = complexity ? complexity.score : 0;
            return <Progress tint={SCORE_TINT[score]} size="sm" value={score} max={4} />
        },
        deriveData: async ({ value }): Promise<ZxcvbnResult | null> => {
            if (!value) return null;
            const { scorePassword } = await import("../../../utils/PasswordScorer");
            return scorePassword(MatrixClientPeg.get(), value, userInputs);
        },
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t(labelEnterPassword),
            },
            {
                key: "complexity",
                test: async function ({ value }, complexity): Promise<boolean> {
                    if (!value || !complexity) {
                        return false;
                    }
                    const safe = complexity.score >= minScore;
                    const allowUnsafe = SdkConfig.get("dangerously_allow_unsafe_and_insecure_passwords");
                    return allowUnsafe || safe;
                },
                valid: function (complexity) {
                    // Unsafe passwords that are valid are only possible through a
                    // configuration flag. We'll print some helper text to signal
                    // to the user that their password is allowed, but unsafe.
                    if (complexity && complexity.score >= minScore) {
                        return _t(labelStrongPassword);
                    }
                    return _t(labelAllowedButUnsafe);
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
    }), [labelEnterPassword, userInputs, minScore, labelStrongPassword, labelAllowedButUnsafe]);
    const [feedback, setFeedback]= useState<string|JSX.Element>();

    const onInputChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((ev) => {
        validateFn({
            value: ev.target.value,
            focused: true,
        }).then((v) => {
            setFeedback(v.feedback);
        })
    }, [validateFn]);


    return <Field id={id} name="password" className={classNames("mx_PassphraseField", className)}>
        <Label>{_t(label)}</Label>
        <PasswordInput ref={fieldRef} autoFocus={autoFocus} onChange={onInputChange} />
        {feedback}
    </Field>
}

export default NewPassphraseField;
