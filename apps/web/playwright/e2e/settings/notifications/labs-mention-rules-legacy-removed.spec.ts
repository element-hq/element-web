/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../element-web-test";
import {
    INTENTIONAL_ROOM_MENTION_RULE,
    INTENTIONAL_USER_MENTION_RULE,
    LEGACY_ROOM_MENTION_RULE,
    LEGACY_USER_MENTION_RULES,
    expectSavedWithoutErrors,
    openLabsNotificationSettings,
    proceedPastUpdateBanner,
    serverPushRules,
    trackPushRuleErrors,
    trackPushRuleWrites,
    turnOffRoomMentions,
    turnOffUserMentions,
} from "./labs-mention-rules";

// `synapseConfig` is worker-scoped and can only be set at the top level of a spec file,
// so each server mode has its own spec file.
test.use({
    displayName: "Alice",
    synapseConfig: {
        experimental_features: {
            // Do not serve the legacy text-matching mention rules (MSC4210)
            msc4210_enabled: true,
        },
    },
});

test.describe("Labs notification settings, legacy mention rules not served", () => {
    test("turning off @room mentions does not write the legacy @room rule", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = serverPushRules(page, homeserver, credentials);
        expect((await fetchRules()).has(LEGACY_ROOM_MENTION_RULE)).toBe(false);
        const errors = trackPushRuleErrors(page);
        const writtenRuleIds = trackPushRuleWrites(page);

        const settings = await openLabsNotificationSettings(app);
        await proceedPastUpdateBanner(settings);
        await turnOffRoomMentions(settings, fetchRules);

        await expectSavedWithoutErrors(settings, errors);
        expect(writtenRuleIds).toContain(INTENTIONAL_ROOM_MENTION_RULE);
        expect(writtenRuleIds).not.toContain(LEGACY_ROOM_MENTION_RULE);
    });

    test("turning off user mentions does not write the legacy display name and user name rules", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = serverPushRules(page, homeserver, credentials);
        const initialRules = await fetchRules();
        expect(LEGACY_USER_MENTION_RULES.filter((ruleId) => initialRules.has(ruleId))).toEqual([]);
        const errors = trackPushRuleErrors(page);
        const writtenRuleIds = trackPushRuleWrites(page);

        const settings = await openLabsNotificationSettings(app);
        await proceedPastUpdateBanner(settings);
        await turnOffUserMentions(settings, fetchRules);

        await expectSavedWithoutErrors(settings, errors);
        expect(writtenRuleIds).toContain(INTENTIONAL_USER_MENTION_RULE);
        expect(writtenRuleIds.filter((ruleId) => LEGACY_USER_MENTION_RULES.includes(ruleId))).toEqual([]);
    });
});
