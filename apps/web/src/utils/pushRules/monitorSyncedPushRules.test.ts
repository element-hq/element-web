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
    PushRuleKind,
    RuleId,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { getMockClientWithEventEmitter } from "test-utils";

import { monitorSyncedPushRules } from "./monitorSyncedPushRules";
import { StandardActions } from "../../notifications/StandardActions";

const loudActions = [
    PushRuleActionName.Notify,
    { set_tweak: TweakName.Sound, value: "default" },
    { set_tweak: TweakName.Highlight },
];

const isUserMentionRule = {
    rule_id: RuleId.IsUserMention,
    default: true,
    enabled: true,
    actions: loudActions,
} as IPushRule;
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
const isRoomMentionRule = {
    rule_id: RuleId.IsRoomMention,
    default: true,
    enabled: true,
    actions: StandardActions.ACTION_HIGHLIGHT,
} as IPushRule;
const roomNotifRule = {
    rule_id: RuleId.AtRoomNotification,
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

    it("does nothing when the legacy mention rules agree with the intentional ones", async () => {
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

    it("writes the legacy mention rules to match the intentional rules when they disagree", async () => {
        // intentional rules changed elsewhere: user mentions off, @room mentions set to 'on'
        const client = makeClient(
            makePushRules(
                [
                    { ...isUserMentionRule, enabled: false },
                    containsDisplayNameRule,
                    { ...isRoomMentionRule, actions: StandardActions.ACTION_NOTIFY },
                    roomNotifRule,
                ],
                [containsUserNameRule],
            ),
        );

        await monitorSyncedPushRules(pushRulesEvent, client);
        await flushPromises();

        // the intentional rules are never written
        expect(client.setPushRuleActions).not.toHaveBeenCalledWith(
            "global",
            expect.anything(),
            RuleId.IsUserMention,
            expect.anything(),
        );
        expect(client.setPushRuleEnabled).not.toHaveBeenCalledWith(
            "global",
            expect.anything(),
            RuleId.IsUserMention,
            expect.anything(),
        );
        expect(client.setPushRuleActions).not.toHaveBeenCalledWith(
            "global",
            expect.anything(),
            RuleId.IsRoomMention,
            expect.anything(),
        );

        // the legacy user mention rules follow the intentional rule
        expect(client.setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.ContentSpecific,
            RuleId.ContainsUserName,
            false,
        );
        expect(client.setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            RuleId.ContainsDisplayName,
            false,
        );
        // the legacy @room rule follows the intentional rule
        expect(client.setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            RuleId.AtRoomNotification,
            StandardActions.ACTION_NOTIFY,
        );
        expect(client.setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            RuleId.AtRoomNotification,
            true,
        );
    });

    it("does nothing when the server does not serve the legacy mention rules", async () => {
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
});
