/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test as base } from "../../element-web-test";
import { selectHomeserver } from "../utils";
import { emailHomeserver } from "../../plugins/homeserver/synapse/emailHomeserver.ts";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { type Credentials } from "../../plugins/homeserver";

const email = "user@nowhere.dummy";

const test = base.extend<{ credentials: Pick<Credentials, "username" | "password"> }>({
    // eslint-disable-next-line no-empty-pattern
    credentials: async ({}, use, testInfo) => {
        await use({
            username: `user_${testInfo.testId}`,
            // this has to be password-like enough to please zxcvbn. Needless to say it's just from pwgen.
            password: "oETo7MPf0o",
        });
    },
});

test.use(emailHomeserver);
test.use({
    config: {
        // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
        // We point that to a guaranteed-invalid domain.
        default_server_config: {
            "m.homeserver": {
                base_url: "https://server.invalid",
            },
        },
    },
});

test.describe("Forgot Password", () => {
    test.skip(isDendrite, "not yet wired up");

    test("renders properly", { tag: "@screenshot" }, async ({ page, homeserver }) => {
        await page.goto("/");

        await page.getByRole("link", { name: "Sign in" }).click();

        // need to select a homeserver at this stage, before entering the forgot password flow
        await selectHomeserver(page, homeserver.baseUrl);

        await page.getByRole("button", { name: "Forgot password?" }).click();

        await expect(page.getByRole("main")).toMatchScreenshot("forgot-password.png");
    });

    test(
        "renders email verification dialog properly",
        { tag: "@screenshot" },
        async ({ page, homeserver, credentials }) => {
            const user = await homeserver.registerUser(credentials.username, credentials.password);

            await homeserver.setThreepid(user.userId, "email", email);

            await page.goto("/");

            await page.getByRole("link", { name: "Sign in" }).click();
            await selectHomeserver(page, homeserver.baseUrl);

            await page.getByRole("button", { name: "Forgot password?" }).click();

            await page.getByRole("textbox", { name: "Email address" }).fill(email);

            await page.getByRole("button", { name: "Send email" }).click();

            await page.getByRole("button", { name: "Next" }).click();

            await page.getByRole("textbox", { name: "New Password", exact: true }).fill(credentials.password);
            await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(credentials.password);

            await page.getByRole("button", { name: "Reset password" }).click();

            await expect(page.getByRole("button", { name: "Resend" })).toBeInViewport();

            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("forgot-password-verify-email.png");
        },
    );
});
