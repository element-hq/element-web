/*
Copyright 2016 OpenMarket Ltd

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

'use strict';

var PushRuleVectorState = require('./PushRuleVectorState');

module.exports = {
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
    parseContentRules: function(rulesets) {
        // first categorise the keyword rules in terms of their actions
        var contentRules = this._categoriseContentRules(rulesets);

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
                vectorState: PushRuleVectorState.LOUD,
                rules: contentRules.loud,
                externalRules: [].concat(contentRules.loud_but_disabled, contentRules.on, contentRules.on_but_disabled, contentRules.other),
            };
        }
        else if (contentRules.loud_but_disabled.length) {
            return {
                vectorState: PushRuleVectorState.OFF,
                rules: contentRules.loud_but_disabled,
                externalRules: [].concat(contentRules.on, contentRules.on_but_disabled, contentRules.other),
            };
        }
        else if (contentRules.on.length) {
            return {
                vectorState: PushRuleVectorState.ON,
                rules: contentRules.on,
                externalRules: [].concat(contentRules.on_but_disabled, contentRules.other),
            };
        }
        else if (contentRules.on_but_disabled.length) {
            return {
                vectorState: PushRuleVectorState.OFF,
                rules: contentRules.on_but_disabled,
                externalRules: contentRules.other,
            }
        } else  {
            return {
                vectorState: PushRuleVectorState.ON,
                rules: [],
                externalRules: contentRules.other,
            }
        }
    },

    _categoriseContentRules: function(rulesets) {
        var contentRules = {on: [], on_but_disabled:[], loud: [], loud_but_disabled: [], other: []};
        for (var kind in rulesets.global) {
            for (var i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
                var r = rulesets.global[kind][i];

                // check it's not a default rule
                if (r.rule_id[0] === '.' || kind !== 'content') {
                    continue;
                }

                r.kind = kind; // is this needed? not sure

                switch (PushRuleVectorState.contentRuleVectorStateKind(r)) {
                    case PushRuleVectorState.ON:
                        if (r.enabled) {
                            contentRules.on.push(r);
                        }
                        else {
                            contentRules.on_but_disabled.push(r);
                        }
                        break;
                    case PushRuleVectorState.LOUD:
                        if (r.enabled) {
                            contentRules.loud.push(r);
                        }
                        else {
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
    },
};
