/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IPushRule, type IPushRules, type PushRuleAction } from "matrix-js-sdk/src/matrix";

import { test, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

const INTENTIONAL_ROOM_MENTION_RULE = ".m.rule.is_room_mention";
const LEGACY_ROOM_MENTION_RULE = ".m.rule.roomnotif";

/** The part of a push rules API URL after `/pushrules/`, e.g. `global/override/<ruleId>/actions`. */
function pushRulePath(url: string | URL): string | undefined {
    return decodeURIComponent(new URL(url).pathname).split("/pushrules/")[1];
}

function actionsPath(ruleId: string): string {
    return `global/override/${ruleId}/actions`;
}

test.use({ displayName: "Alice" });

test.describe("Labs notification settings, update banner", () => {
    /**
     * A fresh account has rules the labs page wants to rewrite, so the page shows an
     * "Update" banner and keeps its controls disabled until the user proceeds.
     *
     * Proceeding gives `.m.rule.is_room_mention` and the legacy `.m.rule.roomnotif` new
     * actions, with two requests sent in parallel. Meanwhile `monitorSyncedPushRules`
     * copies the actions of the legacy rule onto the intentional one whenever a sync shows
     * them out of step. When the intentional rule is written first, the monitor puts its
     * old actions back, the page re-reads the rules, still sees a difference and keeps the
     * banner. The monitor corrects the rule on the next sync, but the page does not read
     * the rules again, so it stays locked until the user proceeds a second time.
     *
     * Which write lands first is down to timing. This test only holds back the write to
     * the legacy rule so the order is always the losing one. No response is altered.
     */
    test("proceeding once unlocks the page", async ({ page, app, user, homeserver, credentials }) => {
        const fetchRules = async (): Promise<Map<string, IPushRule>> => {
            const response = await page.request.get(`${homeserver.baseUrl}/_matrix/client/v3/pushrules/`, {
                headers: { Authorization: `Bearer ${credentials.accessToken}` },
            });
            expect(response.ok()).toBeTruthy();
            const rules = (await response.json()) as IPushRules;
            return new Map(Object.values(rules.global).flatMap((rules) => rules.map((rule) => [rule.rule_id, rule])));
        };

        // Every set of actions the client writes to the intentional rule, in order
        const intentionalRuleWrites: PushRuleAction[][] = [];
        page.on("request", (request) => {
            if (
                request.method() === "PUT" &&
                pushRulePath(request.url()) === actionsPath(INTENTIONAL_ROOM_MENTION_RULE)
            ) {
                intentionalRuleWrites.push(request.postDataJSON().actions);
            }
        });

        // Hold the page's write to the legacy rule until the monitor has reacted to the
        // intentional rule having changed on its own, i.e. until a second write to it.
        let legacyRuleWriteHeld = false;
        await page.route(
            (url) => pushRulePath(url) === actionsPath(LEGACY_ROOM_MENTION_RULE),
            async (route) => {
                if (route.request().method() === "PUT" && !legacyRuleWriteHeld) {
                    legacyRuleWriteHeld = true;
                    const deadline = Date.now() + 10_000;
                    while (intentionalRuleWrites.length < 2 && Date.now() < deadline) {
                        await new Promise((resolve) => setTimeout(resolve, 20));
                    }
                }
                await route.continue();
            },
        );

        await app.settings.setValue("feature_notification_settings2", null, SettingLevel.DEVICE, true);
        const settings = await app.settings.openUserSettings("Notifications");
        const proceed = settings.getByRole("button", { name: "Proceed" });
        await proceed.click();

        // The first write to the intentional rule is the page's, with the actions it wants
        await expect.poll(() => intentionalRuleWrites.length).toBeGreaterThan(0);
        const wantedActions = intentionalRuleWrites[0];

        // The server ends up with those actions on both rules...
        await expect
            .poll(async () => {
                const rules = await fetchRules();
                return [
                    rules.get(INTENTIONAL_ROOM_MENTION_RULE)!.actions,
                    rules.get(LEGACY_ROOM_MENTION_RULE)!.actions,
                ];
            })
            .toEqual([wantedActions, wantedActions]);

        // ...yet the page still believes it has changes to apply and stays locked.
        await expect(
            proceed,
            `The banner should be gone after proceeding once. Writes to ${INTENTIONAL_ROOM_MENTION_RULE}: ` +
                JSON.stringify(intentionalRuleWrites),
        ).not.toBeVisible();
        await expect(settings.getByLabel("Notify when someone mentions using @room")).toBeEnabled();
    });
});
