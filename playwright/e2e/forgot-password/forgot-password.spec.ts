/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import { selectHomeserver } from "../utils";

const username = "user1234";
// this has to be password-like enough to please zxcvbn. Needless to say it's just from pwgen.
const password = "oETo7MPf0o";
const email = "user@nowhere.dummy";

test.describe("Forgot Password", () => {
    test.use({
        startHomeserverOpts: ({ mailhog }, use) =>
            use({
                template: "email",
                variables: {
                    SMTP_HOST: "host.containers.internal",
                    SMTP_PORT: mailhog.instance.smtpPort,
                },
            }),
    });

    test("renders properly", async ({ page, homeserver }) => {
        await page.goto("/");

        await page.getByRole("link", { name: "Sign in" }).click();

        // need to select a homeserver at this stage, before entering the forgot password flow
        await selectHomeserver(page, homeserver.config.baseUrl);

        await page.getByRole("button", { name: "Forgot password?" }).click();

        await expect(page.getByRole("main")).toMatchScreenshot("forgot-password.png");
    });

    test("renders email verification dialog properly", async ({ page, homeserver }) => {
        const user = await homeserver.registerUser(username, password);

        await homeserver.setThreepid(user.userId, "email", email);

        await page.goto("/");

        await page.getByRole("link", { name: "Sign in" }).click();
        await selectHomeserver(page, homeserver.config.baseUrl);

        await page.getByRole("button", { name: "Forgot password?" }).click();

        await page.getByRole("textbox", { name: "Email address" }).fill(email);

        await page.getByRole("button", { name: "Send email" }).click();

        await page.getByRole("button", { name: "Next" }).click();

        await page.getByRole("textbox", { name: "New Password", exact: true }).fill(password);
        await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(password);

        await page.getByRole("button", { name: "Reset password" }).click();

        await expect(page.getByRole("button", { name: "Resend" })).toBeInViewport();

        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("forgot-password-verify-email.png");
    });
});
