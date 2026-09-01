/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import { type IPushRules, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";

import { DefaultNotificationSettings, type NotificationSettings } from "./NotificationSettings";
import { reconcileNotificationSettings } from "./reconcileNotificationSettings";
import { toNotificationSettings } from "./toNotificationSettings";
import { StandardActions } from "../../notifications/StandardActions";
import { RoomNotifState } from "../../RoomNotifs";

describe("NotificationSettings", () => {
    it("parses a typical pushrules setup correctly", async () => {
        const pushRules = (await import("./__mocks__/pushrules_sample.json")) as IPushRules;
        const model = toNotificationSettings(pushRules, false);
        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);
        const expectedModel: NotificationSettings = {
            globalMute: false,
            defaultLevels: {
                dm: RoomNotifState.AllMessages,
                room: RoomNotifState.MentionsOnly,
            },
            sound: {
                calls: "ring",
                mentions: "default",
                people: undefined,
            },
            activity: {
                bot_notices: false,
                invite: true,
                status_event: false,
            },
            mentions: {
                user: true,
                room: true,
                keywords: true,
            },
            keywords: ["justjann3", "justj4nn3", "justj4nne", "Janne", "J4nne", "Jann3", "jann3", "j4nne", "janne"],
        };
        expect(model).toEqual(expectedModel);
        expect(pendingChanges.added).toHaveLength(0);
        expect(pendingChanges.deleted).toHaveLength(0);
        expect(pendingChanges.updated).toHaveLength(0);
    });

    it("generates correct mutations for a changed model", async () => {
        const pushRules = (await import("./__mocks__/pushrules_sample.json")) as IPushRules;
        const pendingChanges = reconcileNotificationSettings(pushRules, DefaultNotificationSettings, false);
        expect(pendingChanges.added).toHaveLength(0);
        expect(pendingChanges.deleted).toEqual([
            { kind: PushRuleKind.ContentSpecific, rule_id: "justjann3" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "justj4nn3" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "justj4nne" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "Janne" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "J4nne" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "Jann3" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "jann3" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "j4nne" },
            { kind: PushRuleKind.ContentSpecific, rule_id: "janne" },
        ]);
        expect(pendingChanges.updated).toEqual([
            {
                kind: PushRuleKind.Underride,
                rule_id: RuleId.EncryptedMessage,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY,
            },
            {
                kind: PushRuleKind.Underride,
                rule_id: RuleId.Message,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY,
            },
            {
                kind: PushRuleKind.Underride,
                rule_id: RuleId.EncryptedDM,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            },
            {
                kind: PushRuleKind.Underride,
                rule_id: RuleId.DM,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            },
            {
                kind: PushRuleKind.Override,
                rule_id: RuleId.SuppressNotices,
                enabled: false,
                actions: StandardActions.ACTION_DONT_NOTIFY,
            },
            {
                kind: PushRuleKind.Override,
                rule_id: RuleId.InviteToSelf,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
            },
        ]);
    });

    it("correctly migrates old settings to the new model", async () => {
        const pushRules = (await import("./__mocks__/pushrules_default.json")) as IPushRules;
        const newPushRules = (await import("./__mocks__/pushrules_default_new.json")) as IPushRules;
        const model = toNotificationSettings(pushRules, false);
        const expectedModel: NotificationSettings = {
            globalMute: false,
            defaultLevels: {
                dm: RoomNotifState.AllMessages,
                room: RoomNotifState.MentionsOnly,
            },
            sound: {
                calls: "ring",
                mentions: "default",
                people: "default",
            },
            activity: {
                bot_notices: false,
                invite: true,
                status_event: true,
            },
            mentions: {
                user: true,
                room: true,
                keywords: true,
            },
            keywords: [],
        };
        expect(model).toEqual(expectedModel);
        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);
        expect(pendingChanges.added).toHaveLength(0);
        expect(pendingChanges.updated).toEqual([
            {
                kind: PushRuleKind.Override,
                rule_id: RuleId.MemberEvent,
                enabled: true,
                actions: StandardActions.ACTION_NOTIFY,
            },
        ]);
        const roundtripPendingChanges = reconcileNotificationSettings(newPushRules, model, false);
        expect(roundtripPendingChanges.added).toHaveLength(0);
        expect(roundtripPendingChanges.deleted).toHaveLength(0);
        expect(roundtripPendingChanges.updated).toHaveLength(0);
    });

    it("handles the bot notice inversion correctly", async () => {
        const pushRules = (await import("./__mocks__/pushrules_bug_botnotices.json")) as IPushRules;
        const model = toNotificationSettings(pushRules, false);
        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);
        const expectedModel: NotificationSettings = {
            globalMute: false,
            defaultLevels: {
                dm: RoomNotifState.AllMessages,
                room: RoomNotifState.MentionsOnly,
            },
            sound: {
                calls: "ring",
                mentions: "default",
                people: undefined,
            },
            activity: {
                bot_notices: true,
                invite: true,
                status_event: false,
            },
            mentions: {
                user: true,
                room: true,
                keywords: true,
            },
            keywords: ["janne"],
        };
        expect(model).toEqual(expectedModel);
        expect(pendingChanges.added).toHaveLength(0);
        expect(pendingChanges.deleted).toHaveLength(0);
        expect(pendingChanges.updated).toHaveLength(0);
    });

    it("correctly handles audible keywords without mentions settings", async () => {
        const pushRules = (await import("./__mocks__/pushrules_bug_keyword_only.json")) as IPushRules;
        const model = toNotificationSettings(pushRules, false);
        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);
        const expectedModel: NotificationSettings = {
            globalMute: false,
            defaultLevels: {
                dm: RoomNotifState.MentionsOnly,
                room: RoomNotifState.MentionsOnly,
            },
            sound: {
                calls: "ring",
                mentions: "default",
                people: undefined,
            },
            activity: {
                bot_notices: true,
                invite: true,
                status_event: false,
            },
            mentions: {
                user: false,
                room: true,
                keywords: true,
            },
            keywords: ["janne"],
        };
        expect(model).toEqual(expectedModel);
        expect(pendingChanges.added).toHaveLength(0);
        expect(pendingChanges.deleted).toHaveLength(0);
        expect(pendingChanges.updated).toHaveLength(0);
    });

    it("stores a keyword that starts with a dot under an id the server will accept", async () => {
        const pushRules = (await import("./__mocks__/pushrules_default.json")) as IPushRules;
        const model = { ...DefaultNotificationSettings, keywords: ["...push complete"] };

        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);

        expect(pendingChanges.added).toEqual([
            expect.objectContaining({
                kind: PushRuleKind.ContentSpecific,
                rule_id: "push complete",
                pattern: "...push complete",
            }),
        ]);
    });

    it("keeps the ids of two keywords that differ only by a leading dot apart", async () => {
        const pushRules = (await import("./__mocks__/pushrules_default.json")) as IPushRules;
        const model = { ...DefaultNotificationSettings, keywords: ["banana", ".banana"] };

        const pendingChanges = reconcileNotificationSettings(pushRules, model, false);

        expect(pendingChanges.added.map((rule) => rule.rule_id)).toEqual(["banana", "banana-2"]);
        expect(pendingChanges.added.map((rule) => rule.pattern)).toEqual(["banana", ".banana"]);
    });
});
