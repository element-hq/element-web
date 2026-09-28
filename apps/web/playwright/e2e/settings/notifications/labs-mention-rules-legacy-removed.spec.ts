/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../element-web-test";
import {
    LEGACY_ROOM_MENTION_RULE,
    expectSavedWithoutErrors,
    openLabsNotificationSettings,
    proceedPastUpdateBanner,
    serverPushRules,
    trackPushRuleErrors,
    turnOffRoomMentions,
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
    test("does not create the legacy rule the server dropped", async ({ page, app, user, homeserver, credentials }) => {
        const fetchRules = serverPushRules(page, homeserver, credentials);
        expect((await fetchRules()).has(LEGACY_ROOM_MENTION_RULE)).toBe(false);
        const errors = trackPushRuleErrors(page);

        const settings = await openLabsNotificationSettings(app);
        await proceedPastUpdateBanner(settings);
        await turnOffRoomMentions(settings, fetchRules);

        await expectSavedWithoutErrors(settings, errors);
        const rules = await fetchRules();
        expect(rules.has(LEGACY_ROOM_MENTION_RULE)).toBe(false);
    });
});
