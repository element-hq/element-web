/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";

const CtrlOrMeta = process.platform === "darwin" ? "Meta" : "Control";

test.describe("Composer", () => {
    test.use({
        displayName: "Janet",
    });

    test.use({
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "Composing Room" });
            await app.viewRoomByName("Composing Room");
            await use({ roomId });
        },
    });

    test.beforeEach(async ({ room }) => {}); // trigger room fixture

    test.describe("Rich text editor", () => {
        test.use({
            labsFlags: ["feature_wysiwyg_composer"],
        });

        test.describe("Commands", () => {
            // TODO add tests for rich text mode

            test.describe("Plain text mode", () => {
                test("autocomplete behaviour tests", async ({ page }) => {
                    // Select plain text mode after composer is ready
                    await expect(page.locator("div[contenteditable=true]")).toBeVisible();
                    await page.getByRole("button", { name: "Hide formatting" }).click();

                    // Typing a single / displays the autocomplete menu and contents
                    await page.getByRole("textbox").press("/");

                    // Check that the autocomplete options are visible and there are more than 0 items
                    await expect(page.getByTestId("autocomplete-wrapper")).not.toBeEmpty();

                    // Entering `//` or `/ ` hides the autocomplete contents
                    // Add an extra slash for `//`
                    await page.getByRole("textbox").press("/");
                    await expect(page.getByTestId("autocomplete-wrapper")).toBeEmpty();
                    // Remove the extra slash to go back to `/`
                    await page.getByRole("textbox").press("Backspace");
                    await expect(page.getByTestId("autocomplete-wrapper")).not.toBeEmpty();
                    // Add a trailing space for `/ `
                    await page.getByRole("textbox").press(" ");
                    await expect(page.getByTestId("autocomplete-wrapper")).toBeEmpty();

                    // Typing a command that takes no arguments (/devtools) and selecting by click works
                    await page.getByRole("textbox").press("Backspace");
                    await page.getByRole("textbox").pressSequentially("dev");
                    await page.getByTestId("autocomplete-wrapper").getByText("/devtools").click();
                    // Check it has closed the autocomplete and put the text into the composer
                    await expect(page.getByTestId("autocomplete-wrapper")).not.toBeVisible();
                    await expect(page.getByRole("textbox").getByText("/devtools")).toBeVisible();
                    // Send the message and check the devtools dialog appeared, then close it
                    await page.getByRole("button", { name: "Send message" }).click();
                    await expect(page.getByRole("dialog").getByText("Developer Tools")).toBeVisible();
                    await page.getByRole("button", { name: "Close dialog" }).click();

                    // Typing a command that takes arguments (/spoiler) and selecting with enter works
                    await page.getByRole("textbox").pressSequentially("/spoil");
                    await expect(page.getByTestId("autocomplete-wrapper").getByText("/spoiler")).toBeVisible();
                    await page.getByRole("textbox").press("Enter");
                    // Check it has closed the autocomplete and put the text into the composer
                    await expect(page.getByTestId("autocomplete-wrapper")).not.toBeVisible();
                    await expect(page.getByRole("textbox").getByText("/spoiler")).toBeVisible();
                    // Enter some more text, then send the message
                    await page.getByRole("textbox").pressSequentially("this is the spoiler text ");
                    await page.getByRole("button", { name: "Send message" }).click();
                    // Check that a spoiler item has appeared in the timeline and contains the spoiler text
                    await expect(page.locator("button.mx_EventTile_spoiler")).toHaveText("this is the spoiler text");
                });
            });
        });

        test.describe("Mentions", () => {
            // TODO add tests for rich text mode

            test.describe("Plain text mode", () => {
                test.use({
                    botCreateOpts: {
                        displayName: "Bob",
                    },
                });

                test("autocomplete behaviour tests", async ({ page, app, bot: bob }) => {
                    // Set up a private room so we have another user to mention
                    await app.client.createRoom({
                        is_direct: true,
                        invite: [bob.credentials.userId],
                    });
                    await app.viewRoomByName("Bob");

                    // Select plain text mode after composer is ready
                    await expect(page.locator("div[contenteditable=true]")).toBeVisible();
                    await page.getByRole("button", { name: "Hide formatting" }).click();

                    // Typing a single @ does not display the autocomplete menu and contents
                    await page.getByRole("textbox").press("@");
                    await expect(page.getByTestId("autocomplete-wrapper")).toBeEmpty();

                    // Entering the first letter of the other user's name opens the autocomplete...
                    await page.getByRole("textbox").pressSequentially(bob.credentials.displayName.slice(0, 1));
                    // ...with the other user name visible, and clicking that username...
                    await page.getByTestId("autocomplete-wrapper").getByText(bob.credentials.displayName).click();
                    // ...inserts the username into the composer
                    const pill = page.getByRole("textbox").getByText(bob.credentials.displayName, { exact: false });
                    await expect(pill).toHaveAttribute("contenteditable", "false");
                    await expect(pill).toHaveAttribute("data-mention-type", "user");

                    // Send the message to clear the composer
                    await page.getByRole("button", { name: "Send message" }).click();

                    // Typing an @, then other user's name, then trailing space closes the autocomplete
                    await page.getByRole("textbox").pressSequentially(`@${bob.credentials.displayName} `);
                    await expect(page.getByTestId("autocomplete-wrapper")).toBeEmpty();

                    // Send the message to clear the composer
                    await page.getByRole("button", { name: "Send message" }).click();

                    // Moving the cursor back to an "incomplete" mention opens the autocomplete
                    await page
                        .getByRole("textbox")
                        .pressSequentially(`initial text @${bob.credentials.displayName.slice(0, 1)} abc`);
                    await expect(page.getByTestId("autocomplete-wrapper")).toBeEmpty();
                    // Move the cursor left by 4 to put it to: `@B| abc`, check autocomplete displays
                    await page.getByRole("textbox").press("ArrowLeft");
                    await page.getByRole("textbox").press("ArrowLeft");
                    await page.getByRole("textbox").press("ArrowLeft");
                    await page.getByRole("textbox").press("ArrowLeft");
                    await expect(page.getByTestId("autocomplete-wrapper")).not.toBeEmpty();

                    // Selecting the autocomplete option using Enter inserts it into the composer
                    await page.getByRole("textbox").press("Enter");
                    const pill2 = page.getByRole("textbox").getByText(bob.credentials.displayName, { exact: false });
                    await expect(pill2).toHaveAttribute("contenteditable", "false");
                    await expect(pill2).toHaveAttribute("data-mention-type", "user");
                });
            });
        });

        test("sends a message when you click send or press Enter", async ({ page }) => {
            // Type a message
            await page.locator("div[contenteditable=true]").pressSequentially("my message 0");
            // It has not been sent yet
            await expect(page.locator(".mx_EventTile_body", { hasText: "my message 0" })).not.toBeVisible();

            // Click send
            await page.getByRole("button", { name: "Send message" }).click();
            // It has been sent
            await expect(page.locator(".mx_EventTile_last .mx_EventTile_body").getByText("my message 0")).toBeVisible();

            // Type another
            await page.locator("div[contenteditable=true]").pressSequentially("my message 1");
            // Send message
            await page.locator("div[contenteditable=true]").press("Enter");
            // It was sent
            await expect(page.locator(".mx_EventTile_last .mx_EventTile_body").getByText("my message 1")).toBeVisible();
        });

        test("sends only one message when you press Enter multiple times", async ({ page }) => {
            // Type a message
            await page.locator("div[contenteditable=true]").pressSequentially("my message 0");
            // It has not been sent yet
            await expect(page.locator(".mx_EventTile_body", { hasText: "my message 0" })).not.toBeVisible();

            // Click send
            await page.locator("div[contenteditable=true]").press("Enter");
            await page.locator("div[contenteditable=true]").press("Enter");
            await page.locator("div[contenteditable=true]").press("Enter");
            // It has been sent
            await expect(page.locator(".mx_EventTile_last .mx_EventTile_body").getByText("my message 0")).toBeVisible();
            await expect(page.locator(".mx_EventTile_last .mx_EventTile_body")).toHaveCount(1);
        });

        test("can write formatted text", async ({ page }) => {
            await page.locator("div[contenteditable=true]").pressSequentially("my ");
            await page.locator("div[contenteditable=true]").press(`${CtrlOrMeta}+KeyB`);
            await page.locator("div[contenteditable=true]").pressSequentially("bold");
            await page.locator("div[contenteditable=true]").press(`${CtrlOrMeta}+KeyB`);
            await page.locator("div[contenteditable=true]").pressSequentially(" message");
            await page.getByRole("button", { name: "Send message" }).click();
            await expect(page.locator(".mx_EventTile_body strong").getByText("bold")).toBeVisible();
        });

        test.describe("when Control+Enter is required to send", () => {
            test.beforeEach(async ({ app }) => {
                await app.settings.setValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            test("only sends when you press Control+Enter", async ({ page }) => {
                // Type a message and press Enter
                await page.locator("div[contenteditable=true]").pressSequentially("my message 3");
                await page.locator("div[contenteditable=true]").press("Enter");
                // It has not been sent yet
                await expect(page.locator(".mx_EventTile_body", { hasText: "my message 3" })).not.toBeVisible();

                // Press Control+Enter
                await page.locator("div[contenteditable=true]").press("Control+Enter");
                // It was sent
                await expect(
                    page.locator(".mx_EventTile_last .mx_EventTile_body").getByText("my message 3"),
                ).toBeVisible();
            });
        });

        test.describe("links", () => {
            test("create link with a forward selection", async ({ page }) => {
                // Type a message
                await page.locator("div[contenteditable=true]").pressSequentially("my message 0");
                await page.locator("div[contenteditable=true]").press(`${CtrlOrMeta}+A`);

                // Open link modal
                await page.getByRole("button", { name: "Link" }).click();
                // Fill the link field
                await page.getByRole("textbox", { name: "Link" }).pressSequentially("https://matrix.org/");
                // Click on save
                await page.getByRole("button", { name: "Save" }).click();
                // Send the message
                await page.getByRole("button", { name: "Send message" }).click();

                // It was sent
                await expect(page.locator(".mx_EventTile_body a").getByText("my message 0")).toBeVisible();
                await expect(page.locator(".mx_EventTile_body a")).toHaveAttribute(
                    "href",
                    new RegExp("https://matrix.org/"),
                );
            });
        });

        test.describe("Drafts", () => {
            test("drafts with rich and plain text", async ({ page, app }) => {
                // Set up a second room to swtich to, to test drafts
                const firstRoomname = "Composing Room";
                const secondRoomname = "Second Composing Room";
                await app.client.createRoom({ name: secondRoomname });

                // Composer is visible
                const composer = page.locator("div[contenteditable=true]");
                await expect(composer).toBeVisible();

                // Type some formatted text
                await composer.pressSequentially("my ");
                await composer.press(`${CtrlOrMeta}+KeyB`);
                await composer.pressSequentially("bold");

                // Change to plain text mode
                await page.getByRole("button", { name: "Hide formatting" }).click();

                // Change to another room and back again
                await app.viewRoomByName(secondRoomname);
                await app.viewRoomByName(firstRoomname);

                // assert the markdown
                await expect(page.locator("div[contenteditable=true]", { hasText: "my __bold__" })).toBeVisible();

                // Change to plain text mode and assert the markdown
                await page.getByRole("button", { name: "Show formatting" }).click();

                // Change to another room and back again
                await app.viewRoomByName(secondRoomname);
                await app.viewRoomByName(firstRoomname);

                // Send the message and assert the message
                await page.getByRole("button", { name: "Send message" }).click();
                await expect(page.locator(".mx_EventTile_last .mx_EventTile_body").getByText("my bold")).toBeVisible();
            });

            test("draft with replies", async ({ page, app }) => {
                // Set up a second room to swtich to, to test drafts
                const firstRoomname = "Composing Room";
                const secondRoomname = "Second Composing Room";
                await app.client.createRoom({ name: secondRoomname });

                // Composer is visible
                const composer = page.locator("div[contenteditable=true]");
                await expect(composer).toBeVisible();

                // Send a message
                await composer.pressSequentially("my first message");
                await page.getByRole("button", { name: "Send message" }).click();

                // Click reply
                const tile = page.locator(".mx_EventTile_last");
                await tile.hover();
                await tile.getByRole("button", { name: "Reply", exact: true }).click();

                // Type reply text
                await composer.pressSequentially("my reply");

                // Change to another room and back again
                await app.viewRoomByName(secondRoomname);
                await app.viewRoomByName(firstRoomname);

                // Assert reply mode and reply text
                await expect(page.getByText("Replying")).toBeVisible();
                await expect(page.locator("div[contenteditable=true]", { hasText: "my reply" })).toBeVisible();
            });

            test("draft in threads", async ({ page, app }) => {
                // Set up a second room to swtich to, to test drafts
                const firstRoomname = "Composing Room";
                const secondRoomname = "Second Composing Room";
                await app.client.createRoom({ name: secondRoomname });

                // Composer is visible
                const composer = page.locator("div[contenteditable=true]");
                await expect(composer).toBeVisible();

                // Send a message
                await composer.pressSequentially("my first message");
                await page.getByRole("button", { name: "Send message" }).click();

                // Click reply
                const tile = page.locator(".mx_EventTile_last");
                await tile.hover();
                await tile.getByRole("button", { name: "Reply in thread" }).click();

                const thread = page.locator(".mx_ThreadView");
                const threadComposer = thread.locator("div[contenteditable=true]");

                // Type threaded text
                await threadComposer.pressSequentially("my threaded message");

                // Change to another room and back again
                await app.viewRoomByName(secondRoomname);
                await app.viewRoomByName(firstRoomname);

                // Assert threaded draft
                await expect(
                    thread.locator("div[contenteditable=true]", { hasText: "my threaded message" }),
                ).toBeVisible();
            });
        });
    });
});
