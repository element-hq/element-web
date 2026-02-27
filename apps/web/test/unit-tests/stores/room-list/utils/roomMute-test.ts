/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ConditionKind, EventType, type IPushRule, MatrixEvent, PushRuleActionName } from "matrix-js-sdk/src/matrix";

import { getChangedOverrideRoomMutePushRules } from "../../../../../src/stores/room-list/utils/roomMute";
import { DEFAULT_PUSH_RULES, getDefaultRuleWithKind, makePushRule } from "../../../../test-utils/pushRules";

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
