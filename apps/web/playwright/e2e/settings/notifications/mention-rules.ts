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
const LEGACY_USER_NAME_RULE = ".m.rule.contains_user_name";
const LEGACY_DISPLAY_NAME_RULE = ".m.rule.contains_display_name";
const LEGACY_ROOM_MENTION_RULE = ".m.rule.roomnotif";
const LEGACY_RULES = [LEGACY_USER_NAME_RULE, LEGACY_DISPLAY_NAME_RULE, LEGACY_ROOM_MENTION_RULE];
const INTENTIONAL_RULES = [USER_MENTION_RULE, ROOM_MENTION_RULE];

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
 * (MSC4210). Synapse stops serving them when `msc4210_enabled` is set.
 *
 * While the server serves the legacy rules, the settings page must not change at all: the
 * legacy rules are the rows, and the intentional rules are written along with them as synced
 * rules. Once the server stops serving them, the intentional rules take their place as rows,
 * and nothing is written to the missing legacy rules.
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

        // The rows shown are the legacy rules while served, and the intentional rules otherwise
        const [userMentionRuleId, roomMentionRuleId, shownRules, hiddenRules] = legacyRulesServed
            ? [LEGACY_USER_NAME_RULE, LEGACY_ROOM_MENTION_RULE, LEGACY_RULES, INTENTIONAL_RULES]
            : [USER_MENTION_RULE, ROOM_MENTION_RULE, INTENTIONAL_RULES, LEGACY_RULES];
        const userMentionRow = settings.getByTestId(`vector_mentions${userMentionRuleId}`);
        const roomMentionRow = settings.getByTestId(`vector_mentions${roomMentionRuleId}`);
        await expect(userMentionRow.getByText("@mentions and replies")).toBeVisible();
        await expect(roomMentionRow.getByText("@room mentions")).toBeVisible();
        for (const ruleId of shownRules) {
            await expect(settings.getByTestId(`vector_mentions${ruleId}`)).toBeVisible();
        }
        for (const ruleId of hiddenRules) {
            await expect(settings.getByTestId(`vector_mentions${ruleId}`)).toHaveCount(0);
        }
        await expect(settings.getByText("Messages containing my display name")).toHaveCount(legacyRulesServed ? 1 : 0);

        // Both rows default to 'Noisy'
        await expect(userMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();
        await expect(roomMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();

        // Turn user mentions off
        await radioLabel(userMentionRow, "Off").click();
        await expect(userMentionRow.getByRole("radio", { name: "Off", exact: true })).toBeChecked();
        await expect(userMentionRow.getByText(UPDATE_ERROR)).toHaveCount(0);

        let rules = await fetchRules();
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(false);
        if (legacyRulesServed) {
            expect(rules.get(LEGACY_USER_NAME_RULE)!.enabled).toBe(false);
            // the display name rule is a row of its own and is left alone
            expect(rules.get(LEGACY_DISPLAY_NAME_RULE)!.enabled).toBe(true);
        } else {
            expect(rules.has(LEGACY_USER_NAME_RULE)).toBe(false);
            expect(rules.has(LEGACY_DISPLAY_NAME_RULE)).toBe(false);
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

        // Turn user mentions back on
        await radioLabel(userMentionRow, "Noisy").click();
        await expect(userMentionRow.getByRole("radio", { name: "Noisy", exact: true })).toBeChecked();

        rules = await fetchRules();
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(true);
        if (legacyRulesServed) {
            expect(rules.get(LEGACY_USER_NAME_RULE)!.enabled).toBe(true);
        }

        expect(errors).toEqual([]);
    });
}

/**
 * The server stops serving the legacy rules while the settings tab is open, as happens
 * when a homeserver is upgraded mid-session. Writes to the legacy rules are still accepted
 * by the homeserver under test, so this covers the current Synapse behaviour; the case where
 * they are rejected is covered by unit tests.
 */
export function mentionNotificationSettingsTransitionTests(): void {
    test("keeps the user's preference when the server stops serving the legacy rules mid-session", async ({
        page,
        app,
        user,
        homeserver,
        credentials,
    }) => {
        const fetchRules = getServerPushRules(page, homeserver.baseUrl, credentials.accessToken);
        const errors = trackPushRuleErrors(page);
        expect((await fetchRules()).has(LEGACY_USER_NAME_RULE)).toBe(true);

        const settings = await app.settings.openUserSettings("Notifications");
        await settings.getByLabel("Enable notifications for this account").check();

        // The user turns user mentions off while the legacy rules are still served
        const legacyUserRow = settings.getByTestId(`vector_mentions${LEGACY_USER_NAME_RULE}`);
        await radioLabel(legacyUserRow, "Off").click();
        await expect(legacyUserRow.getByRole("radio", { name: "Off", exact: true })).toBeChecked();
        let rules = await fetchRules();
        expect(rules.get(LEGACY_USER_NAME_RULE)!.enabled).toBe(false);
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(false);

        // The server stops serving the legacy rules: every read from now on comes back without them
        await page.route(
            (url) => url.pathname.endsWith("/pushrules/"),
            async (route) => {
                const response = await route.fetch();
                const body = (await response.json()) as IPushRules;
                const global = body.global as Record<string, IPushRule[] | undefined>;
                for (const kind of Object.keys(global)) {
                    global[kind] = global[kind]?.filter((rule) => !LEGACY_RULES.includes(rule.rule_id));
                }
                await route.fulfill({ response, json: body });
            },
        );

        // The open tab still shows the legacy rows; the next change goes through one of them
        const legacyRoomRow = settings.getByTestId(`vector_mentions${LEGACY_ROOM_MENTION_RULE}`);
        await radioLabel(legacyRoomRow, "On").click();

        // After the write the page re-reads the rules and switches to the intentional rows
        const userMentionRow = settings.getByTestId(`vector_mentions${USER_MENTION_RULE}`);
        const roomMentionRow = settings.getByTestId(`vector_mentions${ROOM_MENTION_RULE}`);
        await expect(userMentionRow).toBeVisible();
        await expect(roomMentionRow).toBeVisible();
        for (const ruleId of LEGACY_RULES) {
            await expect(settings.getByTestId(`vector_mentions${ruleId}`)).toHaveCount(0);
        }
        await expect(settings.getByText(UPDATE_ERROR)).toHaveCount(0);

        // The preference set before the switch survives it, and the change made during it applied
        await expect(userMentionRow.getByRole("radio", { name: "Off", exact: true })).toBeChecked();
        await expect(roomMentionRow.getByRole("radio", { name: "On", exact: true })).toBeChecked();
        rules = await fetchRules();
        expect(rules.get(USER_MENTION_RULE)!.enabled).toBe(false);
        expect(rules.get(ROOM_MENTION_RULE)!.actions).toEqual(["notify", { set_tweak: "highlight", value: false }]);

        expect(errors).toEqual([]);
    });
}
