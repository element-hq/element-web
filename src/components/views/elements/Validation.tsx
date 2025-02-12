/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import memoizeOne from "memoize-one";

type Data = Pick<IFieldState, "value" | "allowEmpty">;

interface IResult {
    key: string;
    valid: boolean;
    text: string;
}

interface IRule<T, D = undefined> {
    key: string;
    final?: boolean;
    skip?(this: T, data: Data, derivedData: D): boolean;
    test(this: T, data: Data, derivedData: D): boolean | Promise<boolean>;
    valid?(this: T, derivedData: D): string | null;
    invalid?(this: T, derivedData: D): string | null;
}

interface IArgs<T, D = void> {
    rules: IRule<T, D>[];
    description?(this: T, derivedData: D, results: IResult[]): ReactNode;
    hideDescriptionIfValid?: boolean;
    deriveData?(data: Data): Promise<D>;
    memoize?: boolean;
}

export interface IFieldState {
    value: string | null;
    focused: boolean;
    allowEmpty?: boolean;
}

export interface IValidationResult {
    valid?: boolean;
    feedback?: JSX.Element | string;
}

/**
 * Creates a validation function from a set of rules describing what to validate.
 * Generic T is the "this" type passed to the rule methods
 *
 * @param {Function} description
 *     Function that returns a string summary of the kind of value that will
 *     meet the validation rules. Shown at the top of the validation feedback.
 * @param {boolean} hideDescriptionIfValid
 *     If true, don't show the description if the validation passes validation.
 * @param {Function} deriveData
 *     Optional function that returns a Promise to an object of generic type D.
 *     The result of this Promise is passed to rule methods `skip`, `test`, `valid`, and `invalid`.
 *     Useful for doing calculations per-value update once rather than in each of the above rule methods.
 * @param {Object} rules
 *     An array of rules describing how to check to input value. Each rule in an object
 *     and may have the following properties:
 *     - `key`: A unique ID for the rule. Required.
 *     - `skip`: A function used to determine whether the rule should even be evaluated.
 *     - `test`: A function used to determine the rule's current validity. Required.
 *     - `valid`: Function returning text to show when the rule is valid. Only shown if set.
 *     - `invalid`: Function returning text to show when the rule is invalid. Only shown if set.
 *     - `final`: A Boolean if true states that this rule will only be considered if all rules before it returned valid.
 * @param {boolean?} memoize
 *     If true, will use memoization to avoid calling deriveData & rules unless the value or allowEmpty change.
 *     Be careful to not use this if your validation is not pure and depends on other fields, such as "repeat password".
 * @returns {Function}
 *     A validation function that takes in the current input value and returns
 *     the overall validity and a feedback UI that can be rendered for more detail.
 */
export default function withValidation<T = void, D = void>({
    description,
    hideDescriptionIfValid,
    deriveData,
    rules,
    memoize,
}: IArgs<T, D>): (fieldState: IFieldState) => Promise<IValidationResult> {
    let checkRules = async function (
        this: T,
        data: Data,
        derivedData: D,
    ): Promise<[valid: boolean, results: IResult[]]> {
        const results: IResult[] = [];
        let valid = true;
        for (const rule of rules) {
            if (!rule.key || !rule.test) {
                continue;
            }

            if (!valid && rule.final) {
                continue;
            }

            if (rule.skip?.call(this, data, derivedData)) {
                continue;
            }

            // We're setting `this` to whichever component holds the validation
            // function. That allows rules to access the state of the component.
            const ruleValid: boolean = await rule.test.call(this, data, derivedData);
            valid = valid && ruleValid;
            if (ruleValid && rule.valid) {
                // If the rule's result is valid and has text to show for
                // the valid state, show it.
                const text = rule.valid.call(this, derivedData);
                if (!text) {
                    continue;
                }
                results.push({
                    key: rule.key,
                    valid: true,
                    text,
                });
            } else if (!ruleValid && rule.invalid) {
                // If the rule's result is invalid and has text to show for
                // the invalid state, show it.
                const text = rule.invalid.call(this, derivedData);
                if (!text) {
                    continue;
                }
                results.push({
                    key: rule.key,
                    valid: false,
                    text,
                });
            }
        }

        return [valid, results];
    };

    // We have to memoize it in chunks as `focused` can change frequently, but it isn't passed to these methods
    if (memoize) {
        if (deriveData) deriveData = memoizeOne(deriveData, isDataEqual);
        checkRules = memoizeOne(checkRules, isDerivedDataEqual);
    }

    return async function onValidate(
        this: T,
        { value, focused, allowEmpty = true }: IFieldState,
    ): Promise<IValidationResult> {
        if (!value && allowEmpty) {
            return {};
        }

        const data = { value, allowEmpty };
        // We know that if deriveData is set then D will not be undefined
        const derivedData = (await deriveData?.call(this, data)) as D;
        const [valid, results] = await checkRules.call(this, data, derivedData);

        // Hide feedback when not focused
        if (!focused) {
            return { valid };
        }

        let details: ReactNode | undefined;
        if (results && results.length) {
            details = (
                <ul className="mx_Validation_details">
                    {results.map((result) => {
                        const classes = classNames({
                            mx_Validation_detail: true,
                            mx_Validation_valid: result.valid,
                            mx_Validation_invalid: !result.valid,
                        });
                        return (
                            <li key={result.key} className={classes}>
                                {result.text}
                            </li>
                        );
                    })}
                </ul>
            );
        }

        let summary: ReactNode | undefined;
        if (description && (details || !hideDescriptionIfValid)) {
            // We're setting `this` to whichever component holds the validation
            // function. That allows rules to access the state of the component.
            const content = description.call(this, derivedData, results);
            summary = content ? <div className="mx_Validation_description">{content}</div> : undefined;
        }

        let feedback: JSX.Element | undefined;
        if (summary || details) {
            feedback = (
                <div className="mx_Validation">
                    {summary}
                    {details}
                </div>
            );
        }

        return {
            valid,
            feedback,
        };
    };
}

function isDataEqual([a]: [Data], [b]: [Data]): boolean {
    return a.value === b.value && a.allowEmpty === b.allowEmpty;
}

function isDerivedDataEqual([a1, a2]: [Data, any], [b1, b2]: [Data, any]): boolean {
    return a2 === b2 && isDataEqual([a1], [b1]);
}
