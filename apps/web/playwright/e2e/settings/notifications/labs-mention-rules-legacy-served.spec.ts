/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../element-web-test";
import {
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
            // Serve the legacy text-matching mention rules (MSC4210)
            msc4210_enabled: false,
        },
    },
});

test.describe("Labs notification settings, legacy mention rules served", () => {
    test("turning off @room mentions also turns off the legacy @room rule", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = serverPushRules(page, homeserver, credentials);
        expect((await fetchRules()).has(LEGACY_ROOM_MENTION_RULE)).toBe(true);
        const errors = trackPushRuleErrors(page);
        const writtenRuleIds = trackPushRuleWrites(page);

        const settings = await openLabsNotificationSettings(app);
        await proceedPastUpdateBanner(settings);
        await turnOffRoomMentions(settings, fetchRules);

        await expectSavedWithoutErrors(settings, errors);
        // Shows trackPushRuleWrites sees the writes the other spec expects not to happen
        expect(writtenRuleIds).toContain(LEGACY_ROOM_MENTION_RULE);
        const rules = await fetchRules();
        expect(rules.get(LEGACY_ROOM_MENTION_RULE)!.actions).toEqual(["dont_notify"]);
    });

    test("turning off user mentions also turns off the legacy display name and user name rules", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = serverPushRules(page, homeserver, credentials);
        const initialRules = await fetchRules();
        expect(LEGACY_USER_MENTION_RULES.filter((ruleId) => initialRules.has(ruleId))).toEqual(
            LEGACY_USER_MENTION_RULES,
        );
        const errors = trackPushRuleErrors(page);
        const writtenRuleIds = trackPushRuleWrites(page);

        const settings = await openLabsNotificationSettings(app);
        await proceedPastUpdateBanner(settings);
        await turnOffUserMentions(settings, fetchRules);

        await expectSavedWithoutErrors(settings, errors);
        const rules = await fetchRules();
        expect(writtenRuleIds).toEqual(expect.arrayContaining(LEGACY_USER_MENTION_RULES));
        expect(LEGACY_USER_MENTION_RULES.map((ruleId) => rules.get(ruleId)!.actions)).toEqual([
            ["dont_notify"],
            ["dont_notify"],
        ]);
    });
});
