/*
Copyright 2016 OpenMarket Ltd
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { TweakName, PushRuleActionName, TweakHighlight, TweakSound } from "matrix-js-sdk/src/matrix";

import { ContentRules, PushRuleVectorState } from "../../src/notifications";

const NORMAL_RULE = {
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false } as TweakHighlight],
    default: false,
    enabled: true,
    pattern: "vdh2",
    rule_id: "vdh2",
};

const LOUD_RULE = {
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Highlight } as TweakHighlight,
        { set_tweak: TweakName.Sound, value: "default" } as TweakSound,
    ],
    default: false,
    enabled: true,
    pattern: "vdh2",
    rule_id: "vdh2",
};

const USERNAME_RULE = {
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Sound, value: "default" } as TweakSound,
        { set_tweak: TweakName.Highlight } as TweakHighlight,
    ],
    default: true,
    enabled: true,
    pattern: "richvdh",
    rule_id: ".m.rule.contains_user_name",
};

describe("ContentRules", function () {
    describe("parseContentRules", function () {
        it("should handle there being no keyword rules", function () {
            const rules = { global: { content: [USERNAME_RULE] } };
            const parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules).toEqual([]);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.ON);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse regular keyword notifications", function () {
            const rules = { global: { content: [NORMAL_RULE, USERNAME_RULE] } };

            const parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(NORMAL_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.ON);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse loud keyword notifications", function () {
            const rules = { global: { content: [LOUD_RULE, USERNAME_RULE] } };

            const parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(LOUD_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.LOUD);
            expect(parsed.externalRules).toEqual([]);
        });

        it("should parse mixed keyword notifications", function () {
            const rules = { global: { content: [LOUD_RULE, NORMAL_RULE, USERNAME_RULE] } };

            const parsed = ContentRules.parseContentRules(rules);
            expect(parsed.rules.length).toEqual(1);
            expect(parsed.rules[0]).toEqual(LOUD_RULE);
            expect(parsed.vectorState).toEqual(PushRuleVectorState.LOUD);
            expect(parsed.externalRules.length).toEqual(1);
            expect(parsed.externalRules[0]).toEqual(NORMAL_RULE);
        });
    });
});
