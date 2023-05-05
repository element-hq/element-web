/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { ConditionKind, EventType, IPushRule, MatrixEvent, PushRuleActionName } from "matrix-js-sdk/src/matrix";

import { getChangedOverrideRoomMutePushRules } from "../../../../src/stores/room-list/utils/roomMute";
import { DEFAULT_PUSH_RULES, getDefaultRuleWithKind, makePushRule } from "../../../test-utils/pushRules";

describe("getChangedOverrideRoomMutePushRules()", () => {
    const makePushRulesEvent = (overrideRules: IPushRule[] = []): MatrixEvent => {
        return new MatrixEvent({
            type: EventType.PushRules,
            content: {
                global: {
                    ...DEFAULT_PUSH_RULES.global,
                    override: overrideRules,
                },
            },
        });
    };

    it("returns undefined when dispatched action is not accountData", () => {
        const action = { action: "MatrixActions.Event.decrypted", event: new MatrixEvent({}) };
        expect(getChangedOverrideRoomMutePushRules(action)).toBeUndefined();
    });

    it("returns undefined when dispatched action is not pushrules", () => {
        const action = { action: "MatrixActions.accountData", event: new MatrixEvent({ type: "not-push-rules" }) };
        expect(getChangedOverrideRoomMutePushRules(action)).toBeUndefined();
    });

    it("returns undefined when actions event is falsy", () => {
        const action = { action: "MatrixActions.accountData" };
        expect(getChangedOverrideRoomMutePushRules(action)).toBeUndefined();
    });

    it("returns undefined when actions previousEvent is falsy", () => {
        const pushRulesEvent = makePushRulesEvent();
        const action = { action: "MatrixActions.accountData", event: pushRulesEvent };
        expect(getChangedOverrideRoomMutePushRules(action)).toBeUndefined();
    });

    it("filters out non-room specific rules", () => {
        // an override rule that exists in default rules
        const { rule } = getDefaultRuleWithKind(".m.rule.contains_display_name");
        const updatedRule = {
            ...rule,
            actions: [PushRuleActionName.DontNotify],
            enabled: false,
        };
        const previousEvent = makePushRulesEvent([rule]);
        const pushRulesEvent = makePushRulesEvent([updatedRule]);
        const action = { action: "MatrixActions.accountData", event: pushRulesEvent, previousEvent: previousEvent };
        // contains_display_name changed, but is not room-specific
        expect(getChangedOverrideRoomMutePushRules(action)).toEqual([]);
    });

    it("returns ruleIds for added room rules", () => {
        const roomId1 = "!room1:server.org";
        const rule = makePushRule(roomId1, {
            actions: [PushRuleActionName.DontNotify],
            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId1 }],
        });
        const previousEvent = makePushRulesEvent();
        const pushRulesEvent = makePushRulesEvent([rule]);
        const action = { action: "MatrixActions.accountData", event: pushRulesEvent, previousEvent: previousEvent };
        // contains_display_name changed, but is not room-specific
        expect(getChangedOverrideRoomMutePushRules(action)).toEqual([rule.rule_id]);
    });

    it("returns ruleIds for removed room rules", () => {
        const roomId1 = "!room1:server.org";
        const rule = makePushRule(roomId1, {
            actions: [PushRuleActionName.DontNotify],
            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId1 }],
        });
        const previousEvent = makePushRulesEvent([rule]);
        const pushRulesEvent = makePushRulesEvent();
        const action = { action: "MatrixActions.accountData", event: pushRulesEvent, previousEvent: previousEvent };
        // contains_display_name changed, but is not room-specific
        expect(getChangedOverrideRoomMutePushRules(action)).toEqual([rule.rule_id]);
    });
});
