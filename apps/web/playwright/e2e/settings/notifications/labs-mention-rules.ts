/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";
import { type IPushRule, type IPushRules } from "matrix-js-sdk/src/matrix";

import { expect } from "../../../element-web-test";
import { type ElementAppPage } from "../../../pages/ElementAppPage";
import { type Credentials, type HomeserverInstance } from "../../../plugins/homeserver";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

export const INTENTIONAL_USER_MENTION_RULE = ".m.rule.is_user_mention";
export const INTENTIONAL_ROOM_MENTION_RULE = ".m.rule.is_room_mention";

// Removed from the spec in Matrix v1.17 (MSC4210); Synapse stops serving them when `msc4210_enabled` is set.
export const LEGACY_USER_MENTION_RULES = [".m.rule.contains_display_name", ".m.rule.contains_user_name"];
export const LEGACY_ROOM_MENTION_RULE = ".m.rule.roomnotif";

type ServerPushRules = () => Promise<Map<string, IPushRule>>;

/**
 * Fetch the push rules straight from the homeserver, bypassing the client-side
 * defaults matrix-js-sdk merges in, so the assertions reflect the server's state.
 */
export function serverPushRules(page: Page, homeserver: HomeserverInstance, credentials: Credentials): ServerPushRules {
    return async () => {
        const response = await page.request.get(`${homeserver.baseUrl}/_matrix/client/v3/pushrules/`, {
            headers: { Authorization: `Bearer ${credentials.accessToken}` },
        });
        expect(response.ok()).toBeTruthy();
        const rules = (await response.json()) as IPushRules;
        return new Map(Object.values(rules.global).flatMap((rules) => rules.map((rule) => [rule.rule_id, rule])));
    };
}

/**
 * Record every failed request to the push rules API, so a test can assert that
 * the client never writes to a rule the server does not have.
 */
export function trackPushRuleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("response", (response) => {
        if (response.url().includes("/pushrules/") && response.status() >= 400) {
            errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
    });
    return errors;
}

/**
 * Record the ID of every push rule the client writes to, whatever the server answers.
 */
export function trackPushRuleWrites(page: Page): string[] {
    const ruleIds: string[] = [];
    page.on("request", (request) => {
        const path = decodeURIComponent(new URL(request.url()).pathname);
        // .../pushrules/global/<kind>/<ruleId>[/<attribute>]
        const ruleId = path.split("/pushrules/")[1]?.split("/")[2];
        if (request.method() !== "GET" && ruleId) {
            ruleIds.push(ruleId);
        }
    });
    return ruleIds;
}

/**
 * Enable the labs notification settings page and open it.
 *
 * @returns the settings dialog
 */
export async function openLabsNotificationSettings(app: ElementAppPage): Promise<Locator> {
    await app.settings.setValue("feature_notification_settings2", null, SettingLevel.DEVICE, true);
    return app.settings.openUserSettings("Notifications");
}

/**
 * A fresh account has rules the labs page wants to rewrite, so the page shows an
 * "Update" banner and keeps its controls disabled until the user proceeds.
 * Proceeding writes every rule the page manages.
 */
export async function proceedPastUpdateBanner(settings: Locator): Promise<void> {
    const proceed = settings.getByRole("button", { name: "Proceed" });
    await expect(proceed).toBeVisible();
    // TODO: proceed only once when the race between `monitorSyncedPushRules` and the
    // "Proceed" handler is fixed; it can leave the banner up after the first click.
    await expect(async () => {
        // On a retry the banner may already be gone, in which case click() would wait
        // for it instead of letting the assertion pass. The short click timeout covers
        // the banner going away between the check and the click.
        if (await proceed.isVisible()) {
            await proceed.click({ timeout: 1000 });
        }
        await expect(proceed).not.toBeVisible({ timeout: 2000 });
    }).toPass();
}

async function turnOffMentions(
    checkbox: Locator,
    intentionalRuleId: string,
    fetchRules: ServerPushRules,
): Promise<void> {
    await expect(checkbox).toBeEnabled();
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    await expect
        .poll(async () => {
            const rules = await fetchRules();
            return rules.get(intentionalRuleId)!.actions;
        })
        .toEqual(["dont_notify"]);
}

/**
 * Turn off `@room` mentions and wait for the intentional room mention rule on the
 * server to follow.
 */
export async function turnOffRoomMentions(settings: Locator, fetchRules: ServerPushRules): Promise<void> {
    const checkbox = settings.getByLabel("Notify when someone mentions using @room");
    await turnOffMentions(checkbox, INTENTIONAL_ROOM_MENTION_RULE, fetchRules);
}

/**
 * Turn off mentions of the user's display name or user ID and wait for the
 * intentional user mention rule on the server to follow.
 */
export async function turnOffUserMentions(settings: Locator, fetchRules: ServerPushRules): Promise<void> {
    const checkbox = settings.getByLabel(/^Notify when someone mentions using @displayname or /);
    await turnOffMentions(checkbox, INTENTIONAL_USER_MENTION_RULE, fetchRules);
}

/**
 * Assert the page never showed its save error and the client never got a failed
 * response from the push rules API.
 */
export async function expectSavedWithoutErrors(settings: Locator, errors: string[]): Promise<void> {
    await expect(settings.getByText("Your notification settings could not be updated")).toHaveCount(0);
    expect(errors).toEqual([]);
}
