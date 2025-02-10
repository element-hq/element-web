/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MailpitClient } from "mailpit-api";
import { type Page } from "@playwright/test";

import { expect } from "../../element-web-test";

export async function registerAccountMas(
    page: Page,
    mailpit: MailpitClient,
    username: string,
    email: string,
    password: string,
): Promise<void> {
    await expect(page.getByText("Please sign in to continue:")).toBeVisible();

    await page.getByRole("link", { name: "Create Account" }).click();
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await page.getByRole("textbox", { name: "Email address" }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "Confirm Password" }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();

    let code: string;
    await expect(async () => {
        const messages = await mailpit.listMessages();
        expect(messages.messages[0].To[0].Address).toEqual(email);
        const text = await mailpit.renderMessageText(messages.messages[0].ID);
        [, code] = text.match(/Your verification code to confirm this email address is: (\d{6})/);
    }).toPass();

    await page.getByRole("textbox", { name: "6-digit code" }).fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Allow access to your account?")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
}
