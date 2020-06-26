/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {PushRuleVectorState, State} from "./PushRuleVectorState";
import {IExtendedPushRule, IPushRuleSet, IRuleSets} from "./types";

export interface IContentRules {
    vectorState: State;
    rules: IExtendedPushRule[];
    externalRules: IExtendedPushRule[];
}

export const SCOPE = "global";
export const KIND = "content";

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
    static parseContentRules(rulesets: IRuleSets): IContentRules {
        // first categorise the keyword rules in terms of their actions
        const contentRules = this._categoriseContentRules(rulesets);

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
                vectorState: State.Loud,
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
                vectorState: State.Off,
                rules: contentRules.loud_but_disabled,
                externalRules: [...contentRules.on, ...contentRules.on_but_disabled, ...contentRules.other],
            };
        } else if (contentRules.on.length) {
            return {
                vectorState: State.On,
                rules: contentRules.on,
                externalRules: [...contentRules.on_but_disabled, ...contentRules.other],
            };
        } else if (contentRules.on_but_disabled.length) {
            return {
                vectorState: State.Off,
                rules: contentRules.on_but_disabled,
                externalRules: contentRules.other,
            };
        } else {
            return {
                vectorState: State.On,
                rules: [],
                externalRules: contentRules.other,
            };
        }
    }

    static _categoriseContentRules(rulesets: IRuleSets) {
        const contentRules: Record<"on"|"on_but_disabled"|"loud"|"loud_but_disabled"|"other", IExtendedPushRule[]> = {
            on: [],
            on_but_disabled: [],
            loud: [],
            loud_but_disabled: [],
            other: [],
        };

        for (const kind in rulesets.global) {
            for (let i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                const r = rulesets.global[kind][i];

                // check it's not a default rule
                if (r.rule_id[0] === '.' || kind !== "content") {
                    continue;
                }

                // this is needed as we are flattening an object of arrays into a single array
                r.kind = kind;

                switch (PushRuleVectorState.contentRuleVectorStateKind(r)) {
                    case State.On:
                        if (r.enabled) {
                            contentRules.on.push(r);
                        } else {
                            contentRules.on_but_disabled.push(r);
                        }
                        break;
                    case State.Loud:
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
