/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { waitFor, renderHook } from "test-utils-rtl";
import { type IPushRules, type MatrixClient, PushRuleKind, RuleId } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { useNotificationSettings } from "./useNotificationSettings";
import { MatrixClientPeg } from "../MatrixClientPeg";
import {
    DefaultNotificationSettings,
    type NotificationSettings,
} from "../models/notificationsettings/NotificationSettings";
import { StandardActions } from "../notifications/StandardActions";
import { RoomNotifState } from "../RoomNotifs";
import samplePushRules from "../../test/unit-tests/models/notificationsettings/pushrules_sample.json" with { type: "json" };

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
const pushRules = samplePushRules as IPushRules;

describe("useNotificationSettings", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getPushRules = vi.fn(cli.getPushRules).mockResolvedValue(pushRules);
        cli.supportsIntentionalMentions = vi.fn(cli.supportsIntentionalMentions).mockReturnValue(false);
    });

    it("correctly parses model", async () => {
        const { result } = renderHook(() => useNotificationSettings(cli));
        expect(result.current.model).toEqual(null);
        await waitFor(() => expect(result.current.model).toEqual(expectedModel));
        expect(result.current.hasPendingChanges).toBeFalsy();
    });

    it("correctly generates change calls", async () => {
        const addPushRule = vi.fn(cli.addPushRule);
        cli.addPushRule = addPushRule;
        const deletePushRule = vi.fn(cli.deletePushRule);
        cli.deletePushRule = deletePushRule;
        const setPushRuleEnabled = vi.fn(cli.setPushRuleEnabled);
        cli.setPushRuleEnabled = setPushRuleEnabled;
        const setPushRuleActions = vi.fn(cli.setPushRuleActions);
        cli.setPushRuleActions = setPushRuleActions;

        const { result } = renderHook(() => useNotificationSettings(cli));
        expect(result.current.model).toEqual(null);
        await waitFor(() => expect(result.current.model).toEqual(expectedModel));
        expect(result.current.hasPendingChanges).toBeFalsy();
        await result.current.reconcile(DefaultNotificationSettings);
        await waitFor(() => expect(result.current.hasPendingChanges).toBeFalsy());
        expect(addPushRule).toHaveBeenCalledTimes(0);
        expect(deletePushRule).toHaveBeenCalledTimes(9);
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "justjann3");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "justj4nn3");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "justj4nne");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "Janne");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "J4nne");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "Jann3");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "jann3");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "j4nne");
        expect(deletePushRule).toHaveBeenCalledWith("global", PushRuleKind.ContentSpecific, "janne");
        expect(setPushRuleEnabled).toHaveBeenCalledTimes(6);
        expect(setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Underride,
            RuleId.EncryptedMessage,
            true,
        );
        expect(setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.Message, true);
        expect(setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.EncryptedDM, true);
        expect(setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Underride, RuleId.DM, true);
        expect(setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Override, RuleId.SuppressNotices, false);
        expect(setPushRuleEnabled).toHaveBeenCalledWith("global", PushRuleKind.Override, RuleId.InviteToSelf, true);
        expect(setPushRuleActions).toHaveBeenCalledTimes(6);
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Underride,
            RuleId.EncryptedMessage,
            StandardActions.ACTION_NOTIFY,
        );
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Underride,
            RuleId.Message,
            StandardActions.ACTION_NOTIFY,
        );
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Underride,
            RuleId.EncryptedDM,
            StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
        );
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Underride,
            RuleId.DM,
            StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
        );
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            RuleId.SuppressNotices,
            StandardActions.ACTION_DONT_NOTIFY,
        );
        expect(setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            RuleId.InviteToSelf,
            StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
        );
    });
});
