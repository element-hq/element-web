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

import { PushRuleActionName, TweakHighlight, TweakName, TweakSound } from "matrix-js-sdk/src/matrix";

import { PushRuleVectorState } from "../../src/notifications";

describe("PushRuleVectorState", function () {
    describe("contentRuleVectorStateKind", function () {
        it("should understand normal notifications", function () {
            const rule = {
                actions: [PushRuleActionName.Notify],
                default: false,
                enabled: false,
                rule_id: "1",
            };

            expect(PushRuleVectorState.contentRuleVectorStateKind(rule)).toEqual(PushRuleVectorState.ON);
        });

        it("should handle loud notifications", function () {
            const rule = {
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Highlight, value: true } as TweakHighlight,
                    { set_tweak: TweakName.Sound, value: "default" } as TweakSound,
                ],
                default: false,
                enabled: false,
                rule_id: "1",
            };

            expect(PushRuleVectorState.contentRuleVectorStateKind(rule)).toEqual(PushRuleVectorState.LOUD);
        });

        it("should understand missing highlight.value", function () {
            const rule = {
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Highlight } as TweakHighlight,
                    { set_tweak: TweakName.Sound, value: "default" } as TweakSound,
                ],
                default: false,
                enabled: false,
                rule_id: "1",
            };

            expect(PushRuleVectorState.contentRuleVectorStateKind(rule)).toEqual(PushRuleVectorState.LOUD);
        });
    });
});
