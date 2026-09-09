/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";
import { type IPushRule, type IPushRules } from "matrix-js-sdk/src/matrix";

import { test, expect } from "../../../element-web-test";

const USER_MENTION_RULE = ".m.rule.is_user_mention";
const ROOM_MENTION_RULE = ".m.rule.is_room_mention";
const LEGACY_USER_MENTION_RULES = [".m.rule.contains_user_name", ".m.rule.contains_display_name"];
const LEGACY_ROOM_MENTION_RULE = ".m.rule.roomnotif";

const UPDATE_ERROR =
    "An error occurred when updating your notification preferences. Please try to toggle your option again.";

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
 * The radio inputs of a notification rule row are visually hidden; click the label wrapping one.
 */
function radioLabel(row: Locator, name: string): Locator {
    return row.locator(`label:has(input[type="radio"][aria-label="${name}"])`);
}

/**
 * The legacy text-matching mention rules were removed from the spec in Matrix v1.17
 * (MSC4210). Synapse stops serving them when `msc4210_enabled` is set. The settings
 * page must work, without writing to missing rules, whether or not the server serves them.
 *
 * `synapseConfig` is a worker-scoped fixture and can only be set at the top level of a
 * spec file, so each mode lives in its own spec file and both share these tests.
 *
 * @param legacyRulesServed - whether the homeserver under test still serves the legacy rules
 */
export function mentionNotificationSettingsTests(legacyRulesServed: boolean): void {
    test("shows the mention rules and writes them to the server", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = getServerPushRules(page, homeserver.baseUrl, credentials.accessToken);
        const errors = trackPushRuleErrors(page);

        // Make sure the homeserver is in the mode this test is about
        const initialRules = await fetchRules();
        expect(initialRules.has(LEGACY_ROOM_MENTION_RULE)).toBe(legacyRulesServed);
        expect(initialRules.has(USER_MENTION_RULE)).toBe(true);

        const settings = await app.settings.openUserSettings("Notifications");
        await settings.getByLabel("Enable notifications for this account").check();

        const userMentionRow = settings.getByTestId(`vector_mentions${USER_MENTION_RULE}`);
        const roomMentionRow = settings.getByTestId(`vector_mentions${ROOM_MENTION_RULE}`);
        await expect(userMentionRow.getByText("@mentions and replies")).toBeVisible();
        await expect(roomMentionRow.getByText("@room mentions")).toBeVisible();
        await expect(settings.getByText("Messages containing my display name")).toHaveCount(0);
        for (const ruleId of [...LEGACY_USER_MENTION_RULES, LEGACY_ROOM_MENTION_RULE]) {
            await expect(settings.getByTestId(`vector_mentions${ruleId}`)).toHaveCount(0);
        }

        // Both rules default to 'Noisy'
        await expect(userMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();
        await expect(roomMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();

        // Turn user mentions off
        await radioLabel(userMentionRow, "Off").click();
        await expect(userMentionRow.getByRole("radio", { name: "Off", exact: true })).toBeChecked();
        await expect(userMentionRow.getByText(UPDATE_ERROR)).toHaveCount(0);

        let rules = await fetchRules();
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(false);
        for (const ruleId of LEGACY_USER_MENTION_RULES) {
            if (legacyRulesServed) {
                expect(rules.get(ruleId)!.enabled).toBe(false);
            } else {
                expect(rules.has(ruleId)).toBe(false);
            }
        }

        // Turn @room mentions down to 'On'
        await radioLabel(roomMentionRow, "On").click();
        await expect(roomMentionRow.getByRole("radio", { name: "On", exact: true })).toBeChecked();
        await expect(roomMentionRow.getByText(UPDATE_ERROR)).toHaveCount(0);

        rules = await fetchRules();
        const onActions = ["notify", { set_tweak: "highlight", value: false }];
        expect(rules.get(ROOM_MENTION_RULE)!.enabled).toBe(true);
        expect(rules.get(ROOM_MENTION_RULE)!.actions).toEqual(onActions);
        if (legacyRulesServed) {
            expect(rules.get(LEGACY_ROOM_MENTION_RULE)!.enabled).toBe(true);
            expect(rules.get(LEGACY_ROOM_MENTION_RULE)!.actions).toEqual(onActions);
        } else {
            expect(rules.has(LEGACY_ROOM_MENTION_RULE)).toBe(false);
        }

        // Turn user mentions back on: the rule and, when served, its legacy rules are re-enabled
        await radioLabel(userMentionRow, "Noisy").click();
        await expect(userMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();

        rules = await fetchRules();
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(true);
        if (legacyRulesServed) {
            for (const ruleId of LEGACY_USER_MENTION_RULES) {
                expect(rules.get(ruleId)!.enabled).toBe(true);
            }
        }

        expect(errors).toEqual([]);
    });
}
