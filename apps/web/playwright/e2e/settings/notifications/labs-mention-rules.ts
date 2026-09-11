/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";
import { type IPushRule, type IPushRules } from "matrix-js-sdk/src/matrix";

import { test, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

const ROOM_MENTION_RULE = ".m.rule.is_room_mention";
const LEGACY_ROOM_MENTION_RULE = ".m.rule.roomnotif";

const LABS_UPDATE_ERROR = "Your notification settings could not be updated";

/**
 * Record every failed request to the push rules API, so a test can assert that
 * the client never writes to a rule the server does not have.
 */
function trackPushRuleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("response", (response) => {
        if (response.url().includes("/pushrules/") && response.status() >= 400) {
            errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
    });
    return errors;
}

/**
 * Fetch the push rules straight from the homeserver, bypassing the client-side
 * defaults matrix-js-sdk merges in, so the assertions reflect the server's state.
 */
function getServerPushRules(page: Page, baseUrl: string, accessToken: string): () => Promise<Map<string, IPushRule>> {
    return async () => {
        const response = await page.request.get(`${baseUrl}/_matrix/client/v3/pushrules/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        expect(response.ok()).toBeTruthy();
        const rules = (await response.json()) as IPushRules;
        return new Map(Object.values(rules.global).flatMap((rules) => rules.map((rule) => [rule.rule_id, rule])));
    };
}

/**
 * The legacy text-matching mention rules were removed from the spec in Matrix v1.17
 * (MSC4210). Synapse stops serving them when `msc4210_enabled` is set. The labs
 * notification settings page must save, without writing to missing rules, whether or
 * not the server serves them.
 *
 * `synapseConfig` is a worker-scoped fixture and can only be set at the top level of a
 * spec file, so each mode lives in its own spec file and both share this test.
 *
 * @param legacyRulesServed - whether the homeserver under test still serves the legacy rules
 */
export function labsMentionNotificationSettingsTests(legacyRulesServed: boolean): void {
    test("saves the labs notification settings page", async ({ page, app, user, homeserver, credentials }) => {
        const fetchRules = getServerPushRules(page, homeserver.baseUrl, credentials.accessToken);
        const errors = trackPushRuleErrors(page);
        await app.settings.setValue("feature_notification_settings2", null, SettingLevel.DEVICE, true);

        // Make sure the homeserver is in the mode this test is about
        const initialRules = await fetchRules();
        expect(initialRules.has(LEGACY_ROOM_MENTION_RULE)).toBe(legacyRulesServed);

        const settings = await app.settings.openUserSettings("Notifications");
        const roomMentions = settings.getByLabel("Notify when someone mentions using @room");
        await expect(roomMentions).toBeVisible();

        // A fresh account has rules the labs page wants to rewrite; the page is locked until
        // the user lets it. Proceeding writes every rule the page manages.
        const proceed = settings.getByRole("button", { name: "Proceed" });
        if ((await proceed.count()) > 0) {
            await proceed.click();
        }
        await expect(roomMentions).toBeEnabled();
        await expect(roomMentions).toBeChecked();
        await expect(settings.getByText(LABS_UPDATE_ERROR)).toHaveCount(0);

        await roomMentions.uncheck();
        await expect(roomMentions).not.toBeChecked();

        await expect
            .poll(async () => {
                const rules = await fetchRules();
                return rules.get(ROOM_MENTION_RULE)!.actions;
            })
            .toEqual(["dont_notify"]);
        const rules = await fetchRules();
        if (legacyRulesServed) {
            expect(rules.get(LEGACY_ROOM_MENTION_RULE)!.actions).toEqual(["dont_notify"]);
        } else {
            expect(rules.has(LEGACY_ROOM_MENTION_RULE)).toBe(false);
        }

        await expect(settings.getByText(LABS_UPDATE_ERROR)).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}
