/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Threads", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3489");
    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
    });

    test("should be usable for a conversation", { tag: "@screenshot" }, async ({ page, app, bot }) => {
        const roomId = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials.userId);
        await bot.joinRoom(roomId);
        await page.goto("/#/room/" + roomId);

        // Around 200 characters
        const MessageLong =
            "Hello there. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt " +
            "ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi";

        const ThreadViewGroupSpacingStart = "56px"; // --ThreadView_group_spacing-start
        // Exclude timestamp and read marker from snapshots
        const mask = [page.locator(".mx_MessageTimestamp"), page.locator(".mx_MessagePanel_myReadMarker")];

        const roomViewLocator = page.locator(".mx_RoomView_body");
        // User sends message
        const textbox = roomViewLocator.getByRole("textbox", { name: "Send a message…" });
        await textbox.fill("Hello Mr. Bot");
        await textbox.press("Enter");

        // Wait for message to send, get its ID and save as @threadId
        const threadId = await roomViewLocator
            .locator(".mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: "Hello Mr. Bot" })
            .getAttribute("data-scroll-tokens");

        // Bot starts thread
        await bot.sendMessage(roomId, MessageLong, threadId);

        // User asserts timeline thread summary visible & clicks it
        let locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("BotBob")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText(MessageLong)).toBeAttached();
        await locator.click();

        // Wait until the both messages are read
        locator = page.locator(".mx_ThreadView .mx_EventTile_last[data-layout=group]");
        await expect(locator.locator(".mx_EventTile_line .mx_MTextBody").getByText(MessageLong)).toBeAttached();
        await expect(locator.locator(".mx_ReadReceiptGroup .mx_BaseAvatar")).toBeVisible();
        // Make sure the CSS style for spacing is applied to mx_EventTile_line on group/modern layout
        await expect(locator.locator(".mx_EventTile_line")).toHaveCSS(
            "padding-inline-start",
            ThreadViewGroupSpacingStart,
        );

        // Take snapshots in group layout and bubble layout (IRC layout is not available on ThreadView)
        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot("Initial_ThreadView_on_group_layout.png", {
            mask: mask,
        });
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        await expect(page.locator(".mx_ThreadView .mx_EventTile[data-layout='bubble']")).toHaveCount(2);

        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot("Initial_ThreadView_on_bubble_layout.png", {
            mask: mask,
        });

        // Set the group layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        locator = page.locator(".mx_ThreadView .mx_EventTile[data-layout='group'].mx_EventTile_last");
        // Wait until the messages are rendered
        await expect(locator.locator(".mx_EventTile_line .mx_MTextBody").getByText(MessageLong)).toBeAttached();
        // Make sure the avatar inside ReadReceiptGroup is visible on the group layout
        await expect(locator.locator(".mx_ReadReceiptGroup .mx_BaseAvatar")).toBeVisible();

        // Enable the bubble layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

        locator = page.locator(".mx_ThreadView .mx_EventTile[data-layout='bubble'].mx_EventTile_last");
        // TODO: remove this after fixing the issue of ReadReceiptGroup being hidden on the bubble layout
        // See: https://github.com/vector-im/element-web/issues/23569
        await expect(locator.locator(".mx_ReadReceiptGroup .mx_BaseAvatar")).toBeAttached();
        // Make sure the avatar inside ReadReceiptGroup is visible on bubble layout
        // TODO: enable this after fixing the issue of ReadReceiptGroup being hidden on the bubble layout
        // See: https://github.com/vector-im/element-web/issues/23569
        // expect(locator.locator(".mx_ReadReceiptGroup .mx_BaseAvatar")).toBeVisible();

        // Re-enable the group layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        // User responds in thread
        locator = page.locator(".mx_ThreadView").getByRole("textbox", { name: "Send a message…" });
        await locator.fill("Test");
        await locator.press("Enter");

        // User asserts summary was updated correctly
        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("Tom")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("Test")).toBeAttached();

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Check reactions and hidden events
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // Enable hidden events to make the event for reaction displayed
        await app.settings.setValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);

        // User reacts to message instead
        locator = page
            .locator(".mx_ThreadView")
            .locator(".mx_EventTile .mx_EventTile_line")
            .filter({ hasText: "Hello there" });
        await locator.hover();
        await locator.getByRole("toolbar", { name: "Message Actions" }).getByRole("button", { name: "React" }).click();

        locator = page.locator(".mx_EmojiPicker");
        await locator.getByRole("textbox").fill("wave");
        await page.getByRole("gridcell", { name: "👋" }).click();

        locator = page.locator(".mx_ThreadView");
        // Make sure the CSS style for spacing is applied to mx_EventTile_footer on group/modern layout
        await expect(locator.locator(".mx_EventTile[data-layout=group] .mx_EventTile_footer")).toHaveCSS(
            "margin-inline-start",
            ThreadViewGroupSpacingStart,
        );
        // Make sure the CSS style for spacing is applied to the hidden event on group/modern layout
        await expect(
            locator.locator(
                ".mx_GenericEventListSummary[data-layout=group] .mx_EventTile_info.mx_EventTile_last " +
                    ".mx_EventTile_line",
            ),
        ).toHaveCSS("padding-inline-start", ThreadViewGroupSpacingStart);

        // Take snapshot of group layout (IRC layout is not available on ThreadView)
        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
            "ThreadView_with_reaction_and_a_hidden_event_on_group_layout.png",
            {
                mask: mask,
            },
        );

        // Enable bubble layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

        // Make sure the CSS style for spacing is applied to the hidden event on bubble layout
        locator = page.locator(
            ".mx_ThreadView .mx_GenericEventListSummary[data-layout=bubble] .mx_EventTile_info.mx_EventTile_last",
        );
        await expect(locator.locator(".mx_EventTile_line .mx_EventTile_content"))
            // 76px: ThreadViewGroupSpacingStart + 14px + 6px
            // 14px: avatar width
            // See: _EventTile.pcss
            .toHaveCSS("margin-inline-start", "76px");
        await expect(locator.locator(".mx_EventTile_line"))
            // Make sure the margin is NOT applied to mx_EventTile_line
            .toHaveCSS("margin-inline-start", "0px");

        // Take snapshot of bubble layout
        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
            "ThreadView_with_reaction_and_a_hidden_event_on_bubble_layout.png",
            {
                mask: mask,
            },
        );

        // Disable hidden events
        await app.settings.setValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, false);

        // Reset to the group layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Check redactions
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // User redacts their prior response
        locator = page.locator(".mx_ThreadView .mx_EventTile .mx_EventTile_line").filter({ hasText: "Test" });
        await locator.hover();
        await locator.getByRole("button", { name: "Options" }).click();

        await page.locator(".mx_IconizedContextMenu").getByRole("menuitem", { name: "Remove" }).click();
        locator = page.locator(".mx_TextInputDialog").getByRole("button", { name: "Remove" });
        await expect(locator).toHaveClass(/mx_Dialog_primary/);
        await locator.click();

        // Wait until the response is redacted
        // XXX: one would expect this redaction to be shown in the thread the message was in, but due to redactions
        // stripping the thread_id, it is instead shown in the main timeline
        await expect(page.locator(".mx_MainSplit_timeline").locator(".mx_EventTile_last")).toContainText(
            "Message deleted",
        );

        // Take snapshots in group layout and bubble layout (IRC layout is not available on ThreadView)
        await expect(page.locator(".mx_ThreadView .mx_EventTile[data-layout='group']")).toHaveCount(2);
        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
            "ThreadView_with_redacted_messages_on_group_layout.png",
            {
                mask: mask,
            },
        );
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        await expect(page.locator(".mx_ThreadView .mx_EventTile[data-layout='bubble']")).toHaveCount(2);
        await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
            "ThreadView_with_redacted_messages_on_bubble_layout.png",
            {
                mask: mask,
            },
        );

        // Set the group layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        // User asserts summary was updated correctly
        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("BotBob")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText(MessageLong)).toBeAttached();

        // User closes right panel after clicking back to thread list
        locator = page.locator(".mx_ThreadPanel");
        await locator.getByRole("button", { name: "Threads" }).click();
        await locator.getByRole("button", { name: "Close" }).click();

        // Bot responds to thread
        await bot.sendMessage(roomId, "How are things?", threadId);

        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("BotBob")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("How are things?")).toBeAttached();

        locator = page.getByRole("banner").getByRole("button", { name: "Threads" });
        await expect(locator).toHaveAttribute("data-indicator", "success"); // User asserts thread list unread indicator
        await locator.click(); // User opens thread list

        // User asserts thread with correct root & latest events & unread dot
        locator = page.locator(".mx_ThreadPanel .mx_EventTile_last");
        await expect(locator.locator(".mx_EventTile_body").getByText("Hello Mr. Bot")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("How are things?")).toBeAttached();
        // Check the number of the replies
        await expect(locator.locator(".mx_ThreadPanel_replies_amount").getByText("2")).toBeAttached();
        // Make sure the notification dot is visible
        await expect(locator.locator(".mx_NotificationBadge_visible")).toBeVisible();
        // User opens thread via threads list
        await locator.locator(".mx_EventTile_line").click();

        // User responds & asserts
        locator = page.locator(".mx_ThreadView").getByRole("textbox", { name: "Send a message…" });
        await locator.fill("Great!");
        await locator.press("Enter");

        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("Tom")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("Great!")).toBeAttached();

        // User edits & asserts
        locator = page.locator(".mx_ThreadView .mx_EventTile_last");
        await expect(locator.getByText("Great!")).toBeAttached();
        await locator.locator(".mx_EventTile_line").hover();
        await locator.locator(".mx_EventTile_line").getByRole("button", { name: "Edit" }).click();
        await locator.getByRole("textbox").pressSequentially(" How about yourself?"); // fill would overwrite the original text
        await locator.getByRole("textbox").press("Enter");

        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("Tom")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content")).toHaveText("Great! How about yourself?");

        // User closes right panel
        await page.locator(".mx_ThreadPanel").getByRole("button", { name: "Close" }).click();

        // Bot responds to thread and saves the id of their message to @eventId
        const { event_id: eventId } = await bot.sendMessage(roomId, "I'm very good thanks", threadId);

        // User asserts
        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("BotBob")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("I'm very good thanks")).toBeAttached();

        // Bot edits their latest event
        await bot.sendMessage(roomId, {
            "body": "* I'm very good thanks :)",
            "msgtype": "m.text",
            "m.new_content": {
                body: "I'm very good thanks :)",
                msgtype: "m.text",
            },
            "m.relates_to": {
                rel_type: "m.replace",
                event_id: eventId,
            },
        });

        // User asserts
        locator = page.locator(".mx_RoomView_body .mx_ThreadSummary");
        await expect(locator.locator(".mx_ThreadSummary_sender").getByText("BotBob")).toBeAttached();
        await expect(locator.locator(".mx_ThreadSummary_content").getByText("I'm very good thanks :)")).toBeAttached();
    });

    test.describe("with larger viewport", async () => {
        // Increase viewport size so that voice messages fit
        test.use({ viewport: { width: 1280, height: 720 } });

        test.beforeEach(async ({ page }) => {
            // Increase right-panel size, so that voice messages fit
            await page.addInitScript(() => {
                window.localStorage.setItem("mx_rhs_size", "600");
            });
        });

        test("can send voice messages", { tag: ["@no-firefox", "@no-webkit"] }, async ({ page, app, user }) => {
            // Increase right-panel size, so that voice messages fit
            await page.evaluate(() => {
                window.localStorage.setItem("mx_rhs_size", "600");
            });

            const roomId = await app.client.createRoom({});
            await page.goto("/#/room/" + roomId);

            // Send message
            const locator = page.locator(".mx_RoomView_body");
            await locator.getByRole("textbox", { name: "Send a message…" }).fill("Hello Mr. Bot");
            await locator.getByRole("textbox", { name: "Send a message…" }).press("Enter");
            // Create thread
            const locator2 = locator.locator(".mx_EventTile[data-scroll-tokens]").filter({ hasText: "Hello Mr. Bot" });
            await locator2.hover();
            await locator2.getByRole("button", { name: "Reply in thread" }).click();

            await expect(page.locator(".mx_ThreadView_timelinePanelWrapper")).toHaveCount(1);

            await (await app.openMessageComposerOptions(true)).getByRole("menuitem", { name: "Voice Message" }).click();
            await page.waitForTimeout(3000);
            await app.getComposer(true).getByRole("button", { name: "Send voice message" }).click();
            await expect(page.locator(".mx_ThreadView .mx_MVoiceMessageBody")).toHaveCount(1);
        });
    });

    test(
        "should send location and reply to the location on ThreadView",
        { tag: ["@screenshot", "@no-firefox"] },
        async ({ page, app, bot }) => {
            const roomId = await app.client.createRoom({});
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);
            await page.goto("/#/room/" + roomId);

            // Exclude timestamp, read marker, and maplibregl-map from snapshots
            const css =
                ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker, .maplibregl-map { visibility: hidden !important; }";

            let locator = page.locator(".mx_RoomView_body");
            // User sends message
            let textbox = locator.getByRole("textbox", { name: "Send a message…" });
            await textbox.fill("Hello Mr. Bot");
            await textbox.press("Enter");
            // Wait for message to send, get its ID and save as @threadId
            const threadId = await locator
                .locator(".mx_EventTile[data-scroll-tokens]")
                .filter({ hasText: "Hello Mr. Bot" })
                .getAttribute("data-scroll-tokens");

            // Bot starts thread
            await bot.sendMessage(roomId, "Hello there", threadId);

            // User clicks thread summary
            await page.locator(".mx_RoomView_body .mx_ThreadSummary").click();

            // User sends location on ThreadView
            await expect(page.locator(".mx_ThreadView")).toBeAttached();
            await (await app.openMessageComposerOptions(true)).getByRole("menuitem", { name: "Location" }).click();
            await page.getByTestId(`share-location-option-Pin`).click();
            await page.locator("#mx_LocationPicker_map").click();
            await page.getByRole("button", { name: "Share location" }).click();
            await expect(page.locator(".mx_ThreadView .mx_EventTile_last .mx_MLocationBody")).toBeAttached({
                timeout: 10000,
            });

            // User replies to the location
            locator = page.locator(".mx_ThreadView");
            await locator.locator(".mx_EventTile_last").hover();
            await locator.locator(".mx_EventTile_last").getByRole("button", { name: "Reply" }).click();
            textbox = locator.getByRole("textbox", { name: "Reply to thread…" });
            await textbox.fill("Please come here");
            await textbox.press("Enter");
            // Wait until the reply is sent
            await expect(locator.locator(".mx_EventTile_last .mx_EventTile_receiptSent")).toBeVisible();

            // Take a snapshot of reply to the shared location
            await page.addStyleTag({ content: css });
            await expect(page.locator(".mx_ThreadView")).toMatchScreenshot("Reply_to_the_location_on_ThreadView.png");
        },
    );

    test("right panel behaves correctly", async ({ page, app, user }) => {
        // Create room
        const roomId = await app.client.createRoom({});
        await page.goto("/#/room/" + roomId);

        // Send message
        let locator = page.locator(".mx_RoomView_body");
        let textbox = locator.getByRole("textbox", { name: "Send a message…" });
        await textbox.fill("Hello Mr. Bot");
        await textbox.press("Enter");
        // Create thread
        const locator2 = locator.locator(".mx_EventTile[data-scroll-tokens]").filter({ hasText: "Hello Mr. Bot" });
        await locator2.hover();
        await locator2.getByRole("button", { name: "Reply in thread" }).click();
        await expect(page.locator(".mx_ThreadView_timelinePanelWrapper")).toHaveCount(1);

        // Send message to thread
        locator = page.locator(".mx_ThreadPanel");
        textbox = locator.getByRole("textbox", { name: "Send a message…" });
        await textbox.fill("Hello Mr. User");
        await textbox.press("Enter");
        await expect(locator.locator(".mx_EventTile_last").getByText("Hello Mr. User")).toBeAttached();
        // Close thread
        await locator.getByTestId("base-card-close-button").click();

        // Open existing thread
        locator = page
            .locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: "Hello Mr. Bot" });
        await locator.hover();
        await locator.getByRole("button", { name: "Reply in thread" }).click();
        await expect(page.locator(".mx_ThreadView_timelinePanelWrapper")).toHaveCount(1);

        locator = page.locator(".mx_BaseCard");
        await expect(locator.locator(".mx_EventTile").first().getByText("Hello Mr. Bot")).toBeAttached();
        await expect(locator.locator(".mx_EventTile").last().getByText("Hello Mr. User")).toBeAttached();
    });

    test("navigate through right panel", async ({ page, app, user }) => {
        // Create room
        const roomId = await app.client.createRoom({});
        await page.goto("/#/room/" + roomId);

        /**
         * Send a message in the main timeline
         * @param message
         */
        const sendMessage = async (message: string) => {
            const messageComposer = page.getByRole("region", { name: "Message composer" });
            const textbox = messageComposer.getByRole("textbox", { name: "Send a message…" });
            await textbox.fill(message);
            await textbox.press("Enter");
        };

        /**
         * Create a thread from the rootMessage and send a message in the thread
         * @param rootMessage
         * @param threadMessage
         */
        const createThread = async (rootMessage: string, threadMessage: string) => {
            // First create a thread
            const roomViewBody = page.locator(".mx_RoomView_body");
            const messageTile = roomViewBody
                .locator(".mx_EventTile[data-scroll-tokens]")
                .filter({ hasText: rootMessage });
            await messageTile.hover();
            await messageTile.getByRole("button", { name: "Reply in thread" }).click();
            await expect(page.locator(".mx_ThreadView_timelinePanelWrapper")).toHaveCount(1);

            // Send a message in the thread
            const threadPanel = page.locator(".mx_ThreadPanel");
            const textbox = threadPanel.getByRole("textbox", { name: "Send a message…" });
            await textbox.fill(threadMessage);
            await textbox.press("Enter");
            await expect(threadPanel.locator(".mx_EventTile_last").getByText(threadMessage)).toBeVisible();
            // Close thread
            await threadPanel.getByTestId("base-card-close-button").click();
        };

        await sendMessage("Hello Mr. Bot");
        await sendMessage("Hello again Mr. Bot");
        await createThread("Hello Mr. Bot", "Hello Mr. User in a thread");
        await createThread("Hello again Mr. Bot", "Hello again Mr. User in a thread");

        // Open thread panel
        await page.locator(".mx_RoomHeader").getByRole("button", { name: "Threads" }).click();
        const threadPanel = page.locator(".mx_ThreadPanel");
        await expect(
            threadPanel.locator(".mx_EventTile_last").getByText("Hello again Mr. User in a thread"),
        ).toBeVisible();

        const rightPanel = page.locator(".mx_RightPanel");
        // Check that the threads are listed
        await expect(rightPanel.locator(".mx_EventTile").getByText("Hello Mr. User in a thread")).toBeVisible();
        await expect(rightPanel.locator(".mx_EventTile").getByText("Hello again Mr. User in a thread")).toBeVisible();

        // Open the first thread
        await rightPanel.locator(".mx_EventTile").getByText("Hello Mr. User in a thread").click();
        await expect(rightPanel.locator(".mx_EventTile").getByText("Hello Mr. User in a thread")).toBeVisible();
        await expect(
            rightPanel.locator(".mx_EventTile").getByText("Hello again Mr. User in a thread"),
        ).not.toBeVisible();
    });
});
