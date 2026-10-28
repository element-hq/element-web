/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import {
    EventType,
    type IPushRule,
    type IPushRules,
    MatrixEvent,
    PushRuleActionName,
    RuleId,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { logger } from "matrix-js-sdk/src/logger";
import { getMockClientWithEventEmitter } from "test-utils";

import { monitorSyncedPushRules } from "./monitorSyncedPushRules";
import { StandardActions } from "../../notifications/StandardActions";

const loudActions = [
    PushRuleActionName.Notify,
    { set_tweak: TweakName.Sound, value: "default" },
    { set_tweak: TweakName.Highlight },
];

// Legacy text-matching mention rules, removed from the spec in Matrix v1.17 (MSC4210).
// While the server serves them, they are the primary rules the intentional rules follow.
const containsUserNameRule = {
    rule_id: RuleId.ContainsUserName,
    pattern: "alice",
    default: true,
    enabled: true,
    actions: loudActions,
} as IPushRule;
const containsDisplayNameRule = {
    rule_id: RuleId.ContainsDisplayName,
    default: true,
    enabled: true,
    actions: loudActions,
} as IPushRule;
const roomNotifRule = {
    rule_id: RuleId.AtRoomNotification,
    default: true,
    enabled: true,
    actions: StandardActions.ACTION_HIGHLIGHT,
} as IPushRule;

// Intentional mention rules (Matrix v1.7)
const isUserMentionRule = {
    rule_id: RuleId.IsUserMention,
    default: true,
    enabled: true,
    actions: loudActions,
} as IPushRule;
const isRoomMentionRule = {
    rule_id: RuleId.IsRoomMention,
    default: true,
    enabled: true,
    actions: StandardActions.ACTION_HIGHLIGHT,
} as IPushRule;

const makePushRules = (override: IPushRule[], content: IPushRule[] = []): IPushRules =>
    ({
        global: { override, content, underride: [], room: [], sender: [] },
        device: {},
    }) as unknown as IPushRules;

const pushRulesEvent = new MatrixEvent({ type: EventType.PushRules, content: {} });

const flushPromises = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve));
    }
};

describe("monitorSyncedPushRules", () => {
    const makeClient = (pushRules: IPushRules) => {
        const client = getMockClientWithEventEmitter({
            setPushRuleActions: vi.fn().mockResolvedValue({}),
            setPushRuleEnabled: vi.fn().mockResolvedValue({}),
        });
        client.pushRules = pushRules;
        // @ts-expect-error simplified test stub
        client.pushProcessor = new PushProcessor(client);
        return client;
    };

    it("ignores account data events that are not push rules", async () => {
        const client = makeClient(
            makePushRules([{ ...isUserMentionRule, enabled: false }, containsDisplayNameRule], [containsUserNameRule]),
        );

        await monitorSyncedPushRules(new MatrixEvent({ type: EventType.Direct, content: {} }), client);
        await flushPromises();

        expect(client.setPushRuleActions).not.toHaveBeenCalled();
        expect(client.setPushRuleEnabled).not.toHaveBeenCalled();
    });

    it("does nothing when the intentional mention rules agree with the legacy ones", async () => {
        const client = makeClient(
            makePushRules(
                [isUserMentionRule, containsDisplayNameRule, isRoomMentionRule, roomNotifRule],
                [containsUserNameRule],
            ),
        );

        await monitorSyncedPushRules(pushRulesEvent, client);
        await flushPromises();

        expect(client.setPushRuleActions).not.toHaveBeenCalled();
        expect(client.setPushRuleEnabled).not.toHaveBeenCalled();
    });

    // Transitional: goes away with the legacy rule definitions once servers no longer serve them.
    it("writes the intentional mention rules to match the legacy rules while the server still serves them", async () => {
        // legacy rules changed elsewhere: user mentions off, @room mentions set to 'on'
        const client = makeClient(
            makePushRules(
                [
                    isUserMentionRule,
                    containsDisplayNameRule,
                    isRoomMentionRule,
                    { ...roomNotifRule, actions: StandardActions.ACTION_NOTIFY },
                ],
                [{ ...containsUserNameRule, enabled: false }],
            ),
        );

        await monitorSyncedPushRules(pushRulesEvent, client);
        await flushPromises();

        expect(client.setPushRuleEnabled).toHaveBeenCalledWith("global", "override", RuleId.IsUserMention, false);
        expect(client.setPushRuleActions).toHaveBeenCalledWith(
            "global",
            "override",
            RuleId.IsRoomMention,
            StandardActions.ACTION_NOTIFY,
        );
        expect(client.setPushRuleEnabled).toHaveBeenCalledWith("global", "override", RuleId.IsRoomMention, true);
        // the legacy rules themselves are never written
        expect(client.setPushRuleActions).not.toHaveBeenCalledWith(
            "global",
            expect.anything(),
            RuleId.AtRoomNotification,
            expect.anything(),
        );
        expect(client.setPushRuleEnabled).not.toHaveBeenCalledWith(
            "global",
            expect.anything(),
            RuleId.ContainsUserName,
            expect.anything(),
        );
    });

    it("leaves the intentional mention rules alone when the server does not serve the legacy rules", async () => {
        const client = makeClient(
            makePushRules([
                { ...isUserMentionRule, enabled: false },
                { ...isRoomMentionRule, enabled: false },
            ]),
        );

        await monitorSyncedPushRules(pushRulesEvent, client);
        await flushPromises();

        expect(client.setPushRuleActions).not.toHaveBeenCalled();
        expect(client.setPushRuleEnabled).not.toHaveBeenCalled();
    });
    it("relies on matrix-js-sdk not adding the legacy mention rules as client defaults", () => {
        // If it did, the monitor would treat a rule the server does not serve as the primary rule.
        const rules = PushProcessor.rewriteDefaultRules(
            logger,
            makePushRules([isUserMentionRule, isRoomMentionRule]),
            "@alice:localhost",
        );
        const ruleIds = Object.values(rules.global)
            .flat()
            .map((rule) => rule.rule_id);

        expect(ruleIds).toContain(RuleId.IsUserMention);
        expect(ruleIds).not.toContain(RuleId.ContainsUserName);
        expect(ruleIds).not.toContain(RuleId.ContainsDisplayName);
        expect(ruleIds).not.toContain(RuleId.AtRoomNotification);
    });
});
