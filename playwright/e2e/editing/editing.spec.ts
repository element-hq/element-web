/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Locator, Page } from "@playwright/test";

import type { EventType, MsgType, ISendEventResponse } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { SettingLevel } from "../../../src/settings/SettingLevel";

const sendEvent = async (app: ElementAppPage, roomId: string): Promise<ISendEventResponse> => {
    return app.sendEvent(roomId, null, "m.room.message" as EventType, {
        msgtype: "m.text" as MsgType,
        body: "Message",
    });
};

test.describe("Editing", () => {
    // Edit "Message"
    const editLastMessage = async (page: Page, edit: string) => {
        const eventTile = page.locator(".mx_RoomView_MessageList .mx_EventTile_last");
        await eventTile.hover();
        await eventTile.getByRole("button", { name: "Edit" }).click();

        const textbox = page.getByRole("textbox", { name: "Edit message" });
        await textbox.fill(edit);
        await textbox.press("Enter");
    };

    const clickEditedMessage = async (page: Page, edited: string) => {
        // Assert that the message was edited
        const eventTile = page.locator(".mx_EventTile", { hasText: edited });
        await expect(eventTile).toBeVisible();
        // Click to display the message edit history dialog
        await eventTile.getByText("(edited)").click();
    };

    const clickButtonViewSource = async (locator: Locator) => {
        const eventTile = locator.locator(".mx_EventTile_line");
        await eventTile.hover();
        // Assert that "View Source" button is rendered and click it
        await eventTile.getByRole("button", { name: "View Source" }).click();
    };

    test.use({
        displayName: "Edith",
        room: async ({ user, app }, use) => {
            const roomId = await app.createRoom({ name: "Test room" });
            await use({ roomId });
        },
    });

    test("should render and interact with the message edit history dialog", async ({ page, user, app, room }) => {
        // Click the "Remove" button on the message edit history dialog
        const clickButtonRemove = async (locator: Locator) => {
            const eventTileLine = locator.locator(".mx_EventTile_line");
            await eventTileLine.hover();
            await eventTileLine.getByRole("button", { name: "Remove" }).click();
        };

        await page.goto(`#/room/${room.roomId}`);

        // Send "Message"
        await sendEvent(app, room.roomId);

        // Edit "Message" to "Massage"
        await editLastMessage(page, "Massage");

        // Assert that the edit label is visible
        await expect(page.locator(".mx_EventTile_edited")).toBeVisible();

        await clickEditedMessage(page, "Massage");

        // Assert that the message edit history dialog is rendered
        const dialog = page.getByRole("dialog");
        const li = dialog.getByRole("listitem").last();
        // Assert CSS styles which are difficult or cannot be detected with snapshots are applied as expected
        await expect(li).toHaveCSS("clear", "both");

        const timestamp = li.locator(".mx_EventTile .mx_MessageTimestamp");
        await expect(timestamp).toHaveCSS("position", "absolute");
        await expect(timestamp).toHaveCSS("inset-inline-start", "0px");
        await expect(timestamp).toHaveCSS("text-align", "center");

        // Assert that monospace characters can fill the content line as expected
        await expect(li.locator(".mx_EventTile .mx_EventTile_content")).toHaveCSS("margin-inline-end", "0px");

        // Assert that zero block start padding is applied to mx_EventTile as expected
        // See: .mx_EventTile on _EventTile.pcss
        await expect(li.locator(".mx_EventTile")).toHaveCSS("padding-block-start", "0px");

        // Assert that the date separator is rendered at the top
        await expect(dialog.getByRole("listitem").first().locator("h2", { hasText: "today" })).toHaveCSS(
            "text-transform",
            "capitalize",
        );

        {
            // Assert that the edited message is rendered under the date separator
            const tile = dialog.locator("li:nth-child(2) .mx_EventTile");
            // Assert that the edited message body consists of both deleted character and inserted character
            // Above the first "e" of "Message" was replaced with "a"
            await expect(tile.locator(".mx_EventTile_body")).toHaveText("Meassage");

            const body = tile.locator(".mx_EventTile_content .mx_EventTile_body");
            await expect(body.locator(".mx_EditHistoryMessage_deletion").getByText("e")).toBeVisible();
            await expect(body.locator(".mx_EditHistoryMessage_insertion").getByText("a")).toBeVisible();
        }

        // Assert that the original message is rendered at the bottom
        await expect(
            dialog
                .locator("li:nth-child(3) .mx_EventTile")
                .locator(".mx_EventTile_content .mx_EventTile_body", { hasText: "Message" }),
        ).toBeVisible();

        // Take a snapshot of the dialog
        await expect(dialog).toHaveScreenshot("message-edit-history-dialog.png", {
            mask: [page.locator(".mx_MessageTimestamp")],
        });

        {
            const tile = dialog.locator("li:nth-child(2) .mx_EventTile");
            await expect(tile.locator(".mx_EventTile_body")).toHaveText("Meassage");
            // Click the "Remove" button again
            await clickButtonRemove(tile);
        }

        // Do nothing and close the dialog to confirm that the message edit history dialog is rendered
        await app.closeDialog();

        {
            // Assert that the message edit history dialog is rendered again after it was closed
            const tile = dialog.locator("li:nth-child(2) .mx_EventTile");
            await expect(tile.locator(".mx_EventTile_body")).toHaveText("Meassage");
            // Click the "Remove" button again
            await clickButtonRemove(tile);
        }

        // This time remove the message really
        const textInputDialog = page.locator(".mx_TextInputDialog");
        await textInputDialog.getByRole("textbox", { name: "Reason (optional)" }).fill("This is a test."); // Reason
        await textInputDialog.getByRole("button", { name: "Remove" }).click();

        // Assert that the message edit history dialog is rendered again
        const messageEditHistoryDialog = page.locator(".mx_MessageEditHistoryDialog");
        // Assert that the date is rendered
        await expect(
            messageEditHistoryDialog.getByRole("listitem").first().locator("h2", { hasText: "today" }),
        ).toHaveCSS("text-transform", "capitalize");

        // Assert that the original message is rendered under the date on the dialog
        await expect(
            messageEditHistoryDialog
                .locator("li:nth-child(2) .mx_EventTile")
                .locator(".mx_EventTile_content .mx_EventTile_body", { hasText: "Message" }),
        ).toBeVisible();

        // Assert that the edited message is gone
        await expect(
            messageEditHistoryDialog.locator(".mx_EventTile_content .mx_EventTile_body", { hasText: "Meassage" }),
        ).not.toBeVisible();

        await app.closeDialog();

        // Assert that the redaction placeholder is rendered
        await expect(
            page
                .locator(".mx_RoomView_MessageList")
                .locator(".mx_EventTile_last .mx_RedactedBody", { hasText: "Message deleted" }),
        ).toBeVisible();
    });

    test("should render 'View Source' button in developer mode on the message edit history dialog", async ({
        page,
        user,
        app,
        room,
    }) => {
        await page.goto(`#/room/${room.roomId}`);

        // Send "Message"
        await sendEvent(app, room.roomId);

        // Edit "Message" to "Massage"
        await editLastMessage(page, "Massage");

        // Assert that the edit label is visible
        await expect(page.locator(".mx_EventTile_edited")).toBeVisible();

        await clickEditedMessage(page, "Massage");

        {
            const dialog = page.getByRole("dialog");
            // Assert that the original message is rendered
            const li = dialog.locator("li:nth-child(3)");
            // Assert that "View Source" is not rendered
            const eventLine = li.locator(".mx_EventTile_line");
            await eventLine.hover();
            await expect(eventLine.getByRole("button", { name: "View Source" })).not.toBeVisible();
        }

        await app.closeDialog();

        // Enable developer mode
        await app.settings.setValue("developerMode", null, SettingLevel.ACCOUNT, true);

        await clickEditedMessage(page, "Massage");

        {
            const dialog = page.getByRole("dialog");
            {
                // Assert that the edited message is rendered
                const li = dialog.locator("li:nth-child(2)");
                // Assert that "Remove" button for the original message is rendered
                const line = li.locator(".mx_EventTile_line");
                await line.hover();
                await expect(line.getByRole("button", { name: "Remove" })).toBeVisible();
                await clickButtonViewSource(li);
            }

            // Assert that view source dialog is rendered and close the dialog
            await app.closeDialog();

            {
                // Assert that the original message is rendered
                const li = dialog.locator("li:nth-child(3)");
                // Assert that "Remove" button for the original message does not exist
                const line = li.locator(".mx_EventTile_line");
                await line.hover();
                await expect(line.getByRole("button", { name: "Remove" })).not.toBeVisible();

                await clickButtonViewSource(li);
            }

            // Assert that view source dialog is rendered and close the dialog
            await app.closeDialog();
        }
    });

    test("should close the composer when clicking save after making a change and undoing it", async ({
        page,
        user,
        app,
        room,
        axe,
        checkA11y,
    }) => {
        axe.disableRules("color-contrast"); // XXX: We have some known contrast issues here
        axe.exclude(".mx_Tooltip_visible"); // XXX: this is fine but would be good to fix

        await page.goto(`#/room/${room.roomId}`);

        await sendEvent(app, room.roomId);

        {
            // Edit message
            const tile = page.locator(".mx_RoomView_body .mx_EventTile").last();
            await expect(tile.getByText("Message", { exact: true })).toBeVisible();
            const line = tile.locator(".mx_EventTile_line");
            await line.hover();
            await line.getByRole("button", { name: "Edit" }).click();
            await checkA11y();
            const editComposer = page.getByRole("textbox", { name: "Edit message" });
            await editComposer.pressSequentially("Foo");
            await editComposer.press("Backspace");
            await editComposer.press("Backspace");
            await editComposer.press("Backspace");
            await editComposer.press("Enter");
            await checkA11y();
        }
        await expect(
            page.locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", { hasText: "Message" }),
        ).toBeVisible();

        // Assert that the edit composer has gone away
        await expect(page.getByRole("textbox", { name: "Edit message" })).not.toBeVisible();
    });
});
