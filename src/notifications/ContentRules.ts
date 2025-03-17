/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IAnnotatedPushRule, type IPushRules, PushRuleKind, type PushRuleSet } from "matrix-js-sdk/src/matrix";

import { PushRuleVectorState, VectorState } from "./PushRuleVectorState";

export interface IContentRules {
    vectorState: VectorState;
    rules: IAnnotatedPushRule[];
    externalRules: IAnnotatedPushRule[];
}

export class ContentRules {
    /**
     * Extract the keyword rules from a list of rules, and parse them
     * into a form which is useful for Vector's UI.
     *
     * Returns an object containing:
     *   rules: the primary list of keyword rules
     *   vectorState: a PushRuleVectorState indicating whether those rules are
     *      OFF/ON/LOUD
     *   externalRules: a list of other keyword rules, with states other than
     *      vectorState
     */
    public static parseContentRules(rulesets: IPushRules): IContentRules {
        // first categorise the keyword rules in terms of their actions
        const contentRules = ContentRules.categoriseContentRules(rulesets);

        // Decide which content rules to display in Vector UI.
        // Vector displays a single global rule for a list of keywords
        // whereas Matrix has a push rule per keyword.
        // Vector can set the unique rule in ON, LOUD or OFF state.
        // Matrix has enabled/disabled plus a combination of (highlight, sound) tweaks.

        // The code below determines which set of user's content push rules can be
        // displayed by the vector UI.
        // Push rules that does not fit, ie defined by another Matrix client, ends
        // in externalRules.
        // There is priority in the determination of which set will be the displayed one.
        // The set with rules that have LOUD tweaks is the first choice. Then, the ones
        // with ON tweaks (no tweaks).

        if (contentRules.loud.length) {
            return {
                vectorState: VectorState.Loud,
                rules: contentRules.loud,
                externalRules: [
                    ...contentRules.loud_but_disabled,
                    ...contentRules.on,
                    ...contentRules.on_but_disabled,
                    ...contentRules.other,
                ],
            };
        } else if (contentRules.loud_but_disabled.length) {
            return {
                vectorState: VectorState.Off,
                rules: contentRules.loud_but_disabled,
                externalRules: [...contentRules.on, ...contentRules.on_but_disabled, ...contentRules.other],
            };
        } else if (contentRules.on.length) {
            return {
                vectorState: VectorState.On,
                rules: contentRules.on,
                externalRules: [...contentRules.on_but_disabled, ...contentRules.other],
            };
        } else if (contentRules.on_but_disabled.length) {
            return {
                vectorState: VectorState.Off,
                rules: contentRules.on_but_disabled,
                externalRules: contentRules.other,
            };
        } else {
            return {
                vectorState: VectorState.On,
                rules: [],
                externalRules: contentRules.other,
            };
        }
    }

    private static categoriseContentRules(
        rulesets: IPushRules,
    ): Record<"on" | "on_but_disabled" | "loud" | "loud_but_disabled" | "other", IAnnotatedPushRule[]> {
        const contentRules: Record<
            "on" | "on_but_disabled" | "loud" | "loud_but_disabled" | "other",
            IAnnotatedPushRule[]
        > = {
            on: [],
            on_but_disabled: [],
            loud: [],
            loud_but_disabled: [],
            other: [],
        };

        for (const kind in rulesets.global) {
            for (let i = 0; i < Object.keys(rulesets.global[kind as keyof PushRuleSet]!).length; ++i) {
                const r = rulesets.global[kind as keyof PushRuleSet]![i] as IAnnotatedPushRule;

                // check it's not a default rule
                if (r.rule_id[0] === "." || kind !== PushRuleKind.ContentSpecific) {
                    continue;
                }

                // this is needed as we are flattening an object of arrays into a single array
                r.kind = kind;

                switch (PushRuleVectorState.contentRuleVectorStateKind(r)) {
                    case VectorState.On:
                        if (r.enabled) {
                            contentRules.on.push(r);
                        } else {
                            contentRules.on_but_disabled.push(r);
                        }
                        break;
                    case VectorState.Loud:
                        if (r.enabled) {
                            contentRules.loud.push(r);
                        } else {
                            contentRules.loud_but_disabled.push(r);
                        }
                        break;
                    default:
                        contentRules.other.push(r);
                        break;
                }
            }
        }
        return contentRules;
    }
}
