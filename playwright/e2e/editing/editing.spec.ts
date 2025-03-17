/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";

import type { EventType, IContent, ISendEventResponse, MsgType, Visibility } from "matrix-js-sdk/src/matrix";
import { expect, test } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { isDendrite } from "../../plugins/homeserver/dendrite";

async function sendEvent(app: ElementAppPage, roomId: string): Promise<ISendEventResponse> {
    return app.client.sendEvent(roomId, null, "m.room.message" as EventType, {
        msgtype: "m.text" as MsgType,
        body: "Message",
    });
}

/** generate a message event which will take up some room on the page. */
function mkPadding(n: number): IContent {
    return {
        msgtype: "m.text" as MsgType,
        body: `padding ${n}`,
        format: "org.matrix.custom.html",
        formatted_body: `<h3>Test event ${n}</h3>\n`.repeat(10),
    };
}

test.describe("Editing", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3488");

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
            const roomId = await app.client.createRoom({ name: "Test room" });
            await use({ roomId });
        },
        botCreateOpts: { displayName: "Bob" },
    });

    test(
        "should render and interact with the message edit history dialog",
        { tag: "@screenshot" },
        async ({ page, user, app, room }) => {
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
            await expect(dialog).toMatchScreenshot("message-edit-history-dialog.png", {
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
        },
    );

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
    }) => {
        axe.disableRules("color-contrast"); // XXX: We have some known contrast issues here

        await page.goto(`#/room/${room.roomId}`);

        await sendEvent(app, room.roomId);

        {
            // Edit message
            const tile = page.locator(".mx_RoomView_body .mx_EventTile").last();
            await expect(tile.getByText("Message", { exact: true })).toBeVisible();
            const line = tile.locator(".mx_EventTile_line");
            await line.hover();
            await line.getByRole("button", { name: "Edit" }).click();
            await expect(axe).toHaveNoViolations();
            const editComposer = page.getByRole("textbox", { name: "Edit message" });
            await editComposer.pressSequentially("Foo");
            await editComposer.press("Backspace");
            await editComposer.press("Backspace");
            await editComposer.press("Backspace");
            await editComposer.press("Enter");
            await app.getComposerField().hover(); // XXX: move the hover to get rid of the "Edit" tooltip
            await expect(axe).toHaveNoViolations();
        }
        await expect(
            page.locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", { hasText: "Message" }),
        ).toBeVisible();

        // Assert that the edit composer has gone away
        await expect(page.getByRole("textbox", { name: "Edit message" })).not.toBeVisible();
    });

    test("should correctly display events which are edited, where we lack the edit event", async ({
        page,
        user,
        app,
        axe,
        bot: bob,
    }) => {
        // This tests the behaviour when a message has been edited some time after it has been sent, and we
        // jump back in room history to view the event, but do not have the actual edit event.
        //
        // In that scenario, we rely on the server to replace the content (pre-MSC3925), or do it ourselves based on
        // the bundled edit event (post-MSC3925).
        //
        // To test it, we need to have a room with lots of events in, so we can jump around the timeline without
        // paginating in the event itself. Hence, we create a bot user which creates the room and populates it before
        // we join.

        // "bob" now creates the room, and sends a load of events in it. Note that all of this happens via calls on
        // the js-sdk rather than Cypress commands, so uses regular async/await.
        const testRoomId = await bob.createRoom({ name: "TestRoom", visibility: "public" as Visibility });

        const { event_id: originalEventId } = await bob.sendMessage(testRoomId, {
            body: "original",
            msgtype: "m.text",
        });

        // send a load of padding events. We make them large, so that they fill the whole screen
        // and the client doesn't end up paginating into the event we want.
        let i = 0;
        while (i < 10) {
            await bob.sendMessage(testRoomId, mkPadding(i++));
        }

        // ... then the edit ...
        const editEventId = (
            await bob.sendMessage(testRoomId, {
                "m.new_content": { body: "Edited body", msgtype: "m.text" },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: originalEventId,
                },
                "body": "* edited",
                "msgtype": "m.text",
            })
        ).event_id;

        // ... then a load more padding ...
        while (i < 20) {
            await bob.sendMessage(testRoomId, mkPadding(i++));
        }

        // now have the cypress user join the room, jump to the original event, and wait for the event to be visible
        await app.client.joinRoom(testRoomId);
        await app.viewRoomByName("TestRoom");
        await page.goto(`#/room/${testRoomId}/${originalEventId}`);

        const messageTile = page.locator(`[data-event-id="${originalEventId}"]`);
        // at this point, the edit event should still be unknown
        const timeline = await app.client.evaluate(
            (cli, { testRoomId, editEventId }) => cli.getRoom(testRoomId).getTimelineForEvent(editEventId),
            { testRoomId, editEventId },
        );
        expect(timeline).toBeNull();

        // nevertheless, the event should be updated
        await expect(messageTile.locator(".mx_EventTile_body")).toHaveText("Edited body");
        await expect(messageTile.locator(".mx_EventTile_edited")).toBeVisible();
    });
});
