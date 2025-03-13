/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import { type ElementAppPage } from "../../pages/ElementAppPage";

// Find and click "Reply" button
const clickButtonReply = async (tile: Locator) => {
    await expect(async () => {
        await tile.hover();
        await tile.getByRole("button", { name: "Reply", exact: true }).click();
    }).toPass();
};

test.describe("Audio player", { tag: ["@no-firefox", "@no-webkit"] }, () => {
    test.use({
        displayName: "Hanako",
    });

    const uploadFile = async (page: Page, file: string) => {
        // Upload a file from the message composer
        await page.locator(".mx_MessageComposer_actions input[type='file']").setInputFiles(file);

        // Find and click primary "Upload" button
        await page.locator(".mx_Dialog").getByRole("button", { name: "Upload" }).click();

        // Wait until the file is sent
        await expect(page.locator(".mx_RoomView_statusArea_expanded")).not.toBeVisible();
        await expect(page.locator(".mx_EventTile.mx_EventTile_last .mx_EventTile_receiptSent")).toBeVisible();
        // wait for the tile to finish loading
        await expect(
            page
                .locator(".mx_AudioPlayer_mediaName")
                .last()
                .filter({ hasText: file.split("/").at(-1) }),
        ).toBeVisible();
    };

    /**
     * Take snapshots of mx_EventTile_last on each layout, outputting log for reference/debugging.
     * @param detail The snapshot name. Used for outputting logs too.
     * @param monospace This changes the font used to render the UI from a default one to Inconsolata. Set to false by default.
     */
    const takeSnapshots = async (page: Page, app: ElementAppPage, detail: string, monospace = false) => {
        // Check that the audio player is rendered and its button becomes visible
        const checkPlayerVisibility = async (locator: Locator) => {
            // Assert that the audio player and media information are visible
            const mediaInfo = locator.locator(
                ".mx_EventTile_mediaLine .mx_MAudioBody .mx_AudioPlayer_container .mx_AudioPlayer_mediaInfo",
            );
            await expect(mediaInfo.locator(".mx_AudioPlayer_mediaName", { hasText: ".ogg" })).toBeVisible(); // extension
            await expect(mediaInfo.locator(".mx_AudioPlayer_byline", { hasText: "00:01" })).toBeVisible();
            await expect(mediaInfo.locator(".mx_AudioPlayer_byline", { hasText: "(3.56 KB)" })).toBeVisible(); // actual size

            // Assert that the play button can be found and is visible
            await expect(locator.getByRole("button", { name: "Play" })).toBeVisible();

            if (monospace) {
                // Assert that the monospace timer is visible
                await expect(locator.locator("[role='timer']")).toHaveCSS("font-family", "Inconsolata");
            }
        };

        if (monospace) {
            // Enable system font and monospace setting
            await app.settings.setValue("useBundledEmojiFont", null, SettingLevel.DEVICE, false);
            await app.settings.setValue("useSystemFont", null, SettingLevel.DEVICE, true);
            await app.settings.setValue("systemFont", null, SettingLevel.DEVICE, "Inconsolata");
        }

        // Check the status of the seek bar
        expect(await page.locator(".mx_AudioPlayer_seek input[type='range']").count()).toBeGreaterThan(0);

        // Enable IRC layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

        const ircTile = page.locator(".mx_EventTile_last[data-layout='irc']");
        // Click the event timestamp to highlight EventTile in case it is not visible
        await ircTile.locator(".mx_MessageTimestamp").click();
        // Assert that rendering of the player settled and the play button is visible before taking a snapshot
        await checkPlayerVisibility(ircTile);

        const screenshotOptions = {
            css: `
                /* The timestamp is of inconsistent width depending on the time the test runs at */
                .mx_MessageTimestamp {
                    display: none !important;
                }
                /* The MAB showing up on hover is not needed for the test */
                .mx_MessageActionBar {
                    display: none !important;
                }
            `,
            mask: [page.locator(".mx_AudioPlayer_seek")],
        };

        // Take a snapshot of mx_EventTile_last on IRC layout
        await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
            `${detail.replaceAll(" ", "-")}-irc-layout.png`,
            screenshotOptions,
        );

        // Take a snapshot on modern/group layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        const groupTile = page.locator(".mx_EventTile_last[data-layout='group']");
        await groupTile.locator(".mx_MessageTimestamp").click();
        await checkPlayerVisibility(groupTile);
        await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
            `${detail.replaceAll(" ", "-")}-group-layout.png`,
            screenshotOptions,
        );

        // Take a snapshot on bubble layout
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        const bubbleTile = page.locator(".mx_EventTile_last[data-layout='bubble']");
        await bubbleTile.locator(".mx_MessageTimestamp").click();
        await checkPlayerVisibility(bubbleTile);
        await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
            `${detail.replaceAll(" ", "-")}-bubble-layout.png`,
            screenshotOptions,
        );
    };

    test.beforeEach(async ({ page, app, user }) => {
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        // Wait until configuration is finished
        await expect(
            page
                .locator(".mx_GenericEventListSummary[data-layout='group'] .mx_GenericEventListSummary_summary")
                .getByText(`${user.displayName} created and configured the room.`),
        ).toBeVisible();
    });

    test("should be correctly rendered - light theme", { tag: "@screenshot" }, async ({ page, app }) => {
        await uploadFile(page, "playwright/sample-files/1sec-long-name-audio-file.ogg");
        await takeSnapshots(page, app, "Selected EventTile of audio player (light theme)");
    });

    test(
        "should be correctly rendered - light theme with monospace font",
        { tag: "@screenshot" },
        async ({ page, app }) => {
            await uploadFile(page, "playwright/sample-files/1sec-long-name-audio-file.ogg");

            await takeSnapshots(page, app, "Selected EventTile of audio player (light theme, monospace font)", true); // Enable monospace
        },
    );

    test("should be correctly rendered - high contrast theme", { tag: "@screenshot" }, async ({ page, app }) => {
        // Disable system theme in case ThemeWatcher enables the theme automatically,
        // so that the high contrast theme can be enabled
        await app.settings.setValue("use_system_theme", null, SettingLevel.DEVICE, false);

        // Enable high contrast manually
        const settings = await app.settings.openUserSettings("Appearance");
        await settings.getByRole("radio", { name: "High contrast" }).click();

        await app.closeDialog();

        await uploadFile(page, "playwright/sample-files/1sec-long-name-audio-file.ogg");

        await takeSnapshots(page, app, "Selected EventTile of audio player (high contrast)");
    });

    test("should be correctly rendered - dark theme", { tag: "@screenshot" }, async ({ page, app }) => {
        // Enable dark theme
        await app.settings.setValue("theme", null, SettingLevel.ACCOUNT, "dark");

        await uploadFile(page, "playwright/sample-files/1sec-long-name-audio-file.ogg");

        await takeSnapshots(page, app, "Selected EventTile of audio player (dark theme)");
    });

    test("should play an audio file", async ({ page, app }) => {
        await uploadFile(page, "playwright/sample-files/1sec.ogg");

        // Assert that the audio player is rendered
        const container = page.locator(".mx_EventTile_last .mx_AudioPlayer_container");
        // Assert that the counter is zero before clicking the play button
        await expect(container.locator(".mx_AudioPlayer_seek [role='timer']", { hasText: "00:00" })).toBeVisible();

        // Find and click "Play" button, the wait is to make the test less flaky
        await expect(container.getByRole("button", { name: "Play" })).toBeVisible();
        await container.getByRole("button", { name: "Play" }).click();

        // Assert that "Pause" button can be found
        await expect(container.getByRole("button", { name: "Pause" })).toBeVisible();

        // Assert that the timer is reset when the audio file finished playing
        await expect(container.locator(".mx_AudioPlayer_seek [role='timer']", { hasText: "00:00" })).toBeVisible();

        // Assert that "Play" button can be found
        await expect(container.getByRole("button", { name: "Play" })).toBeVisible();
    });

    test("should support downloading an audio file", async ({ page, app }) => {
        await uploadFile(page, "playwright/sample-files/1sec.ogg");

        const downloadPromise = page.waitForEvent("download");

        // Find and click "Download" button on MessageActionBar
        const tile = page.locator(".mx_EventTile_last");
        await tile.hover();
        await tile.getByRole("button", { name: "Download" }).click();

        // Assert that the file was downloaded
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("1sec.ogg");
    });

    test(
        "should support replying to audio file with another audio file",
        { tag: "@screenshot" },
        async ({ page, app }) => {
            await uploadFile(page, "playwright/sample-files/1sec.ogg");

            // Assert the audio player is rendered
            await expect(page.locator(".mx_EventTile_last .mx_AudioPlayer_container")).toBeVisible();

            // Find and click "Reply" button on MessageActionBar
            const tile = page.locator(".mx_EventTile_last");
            await clickButtonReply(tile);

            // Reply to the player with another audio file
            await uploadFile(page, "playwright/sample-files/1sec.ogg");

            // Assert that the audio player is rendered
            await expect(tile.locator(".mx_AudioPlayer_container")).toBeVisible();

            // Assert that replied audio file is rendered as file button inside ReplyChain
            const button = tile.locator(".mx_ReplyChain_wrapper .mx_MFileBody_info[role='button']");
            // Assert that the file button has file name
            await expect(button.locator(".mx_MFileBody_info_filename")).toBeVisible();

            await takeSnapshots(page, app, "Selected EventTile of audio player with a reply");
        },
    );

    test(
        "should support creating a reply chain with multiple audio files",
        { tag: "@screenshot" },
        async ({ page, app, user }) => {
            // Note: "mx_ReplyChain" element is used not only for replies which
            // create a reply chain, but also for a single reply without a replied
            // message. This test checks whether a reply chain which consists of
            // multiple audio file replies is rendered properly.

            const tile = page.locator(".mx_EventTile_last");

            await uploadFile(page, "playwright/sample-files/upload-first.ogg");

            // Assert that the audio player is rendered
            await expect(page.locator(".mx_EventTile_last .mx_AudioPlayer_container")).toBeVisible();

            await clickButtonReply(tile);

            // Reply to the player with another audio file
            await uploadFile(page, "playwright/sample-files/upload-second.ogg");

            // Assert that the audio player is rendered
            await expect(page.locator(".mx_EventTile_last .mx_AudioPlayer_container")).toBeVisible();

            await clickButtonReply(tile);

            // Reply to the player with yet another audio file to create a reply chain
            await uploadFile(page, "playwright/sample-files/upload-third.ogg");

            // Assert that the audio player is rendered
            await expect(tile.locator(".mx_AudioPlayer_container")).toBeVisible();

            // Assert that there are two "mx_ReplyChain" elements
            await expect(tile.locator(".mx_ReplyChain")).toHaveCount(2);

            // Assert that one line contains the user name
            await expect(tile.locator(".mx_ReplyChain .mx_ReplyTile_sender").getByText(user.displayName)).toBeVisible();

            // Assert that the other line contains the file button
            await expect(tile.locator(".mx_ReplyChain .mx_MFileBody")).toBeVisible();

            // Click "In reply to"
            await tile.locator(".mx_ReplyChain .mx_ReplyChain_show", { hasText: "In reply to" }).click();

            const replyChain = tile.locator(".mx_ReplyChain:first-of-type");
            // Assert that "In reply to" has disappeared
            await expect(replyChain.getByText("In reply to")).not.toBeVisible();

            // Assert that the file button contains the name of the file sent at first
            await expect(
                replyChain
                    .locator(".mx_MFileBody_info[role='button']")
                    .locator(".mx_MFileBody_info_filename", { hasText: "upload-first.ogg" }),
            ).toBeVisible();

            // Take snapshots
            await takeSnapshots(page, app, "Selected EventTile of audio player with a reply chain");
        },
    );

    test("should be rendered, play, and support replying on a thread", async ({ page, app }) => {
        await uploadFile(page, "playwright/sample-files/1sec-long-name-audio-file.ogg");

        // On the main timeline
        const messageList = page.locator(".mx_RoomView_MessageList");
        // Assert the audio player is rendered
        await expect(messageList.locator(".mx_EventTile_last .mx_AudioPlayer_container")).toBeVisible();
        // Find and click "Reply in thread" button
        await messageList.locator(".mx_EventTile_last").hover();
        await messageList.locator(".mx_EventTile_last").getByRole("button", { name: "Reply in thread" }).click();

        // On a thread
        const thread = page.locator(".mx_ThreadView");
        const threadTile = thread.locator(".mx_EventTile_last");
        const audioPlayer = threadTile.locator(".mx_AudioPlayer_container");

        // Assert that the counter is zero before clicking the play button
        await expect(audioPlayer.locator(".mx_AudioPlayer_seek [role='timer']", { hasText: "00:00" })).toBeVisible();

        // Find and click "Play" button, the wait is to make the test less flaky
        await expect(audioPlayer.getByRole("button", { name: "Play" })).toBeVisible();
        await audioPlayer.getByRole("button", { name: "Play" }).click();

        // Assert that "Pause" button can be found
        await expect(audioPlayer.getByRole("button", { name: "Pause" })).toBeVisible();

        // Assert that the timer is reset when the audio file finished playing
        await expect(audioPlayer.locator(".mx_AudioPlayer_seek [role='timer']", { hasText: "00:00" })).toBeVisible();

        // Assert that "Play" button can be found
        await expect(audioPlayer.getByRole("button", { name: "Play" })).not.toBeDisabled();

        // Find and click "Reply" button
        await threadTile.hover();
        await threadTile.getByRole("button", { name: "Reply", exact: true }).click();

        const composer = thread.locator(".mx_MessageComposer--compact");
        // Assert that the reply preview contains audio ReplyTile the file info button
        await expect(
            composer.locator(".mx_ReplyPreview .mx_ReplyTile_audio .mx_MFileBody_info[role='button']"),
        ).toBeVisible();

        // Select :smile: emoji and send it
        await composer.getByTestId("basicmessagecomposer").fill(":smile:");
        await composer.locator(".mx_Autocomplete_Completion[aria-selected='true']").click();
        await composer.getByTestId("basicmessagecomposer").press("Enter");

        // Assert that the file name is rendered on the file button
        await expect(threadTile.locator(".mx_ReplyTile_audio .mx_MFileBody_info[role='button']")).toBeVisible();
    });
});
