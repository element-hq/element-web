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

import { IPushRules, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";

import {
    DefaultNotificationSettings,
    NotificationSettings,
} from "../../../src/models/notificationsettings/NotificationSettings";
import { reconcileNotificationSettings } from "../../../src/models/notificationsettings/reconcileNotificationSettings";
import { toNotificationSettings } from "../../../src/models/notificationsettings/toNotificationSettings";
import { StandardActions } from "../../../src/notifications/StandardActions";
import { RoomNotifState } from "../../../src/RoomNotifs";

describe("NotificationSettings", () => {
    it("parses a typical pushrules setup correctly", async () => {
        const pushRules = (await import("./pushrules_sample.json")) as IPushRules;
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
        const pushRules = (await import("./pushrules_sample.json")) as IPushRules;
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
        const pushRules = (await import("./pushrules_default.json")) as IPushRules;
        const newPushRules = (await import("./pushrules_default_new.json")) as IPushRules;
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
        const pushRules = (await import("./pushrules_bug_botnotices.json")) as IPushRules;
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
        const pushRules = (await import("./pushrules_bug_keyword_only.json")) as IPushRules;
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
});
