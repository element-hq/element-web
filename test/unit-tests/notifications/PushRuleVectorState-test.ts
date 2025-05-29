/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PushRuleActionName, type TweakHighlight, TweakName, type TweakSound } from "matrix-js-sdk/src/matrix";

import { PushRuleVectorState } from "../../../src/notifications";

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
