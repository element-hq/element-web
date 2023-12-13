/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import * as fs from "node:fs";

import type { Locator, Page } from "@playwright/test";
import type { ISendEventResponse, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import { Client } from "../../pages/client";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { Bot } from "../../pages/bot";

// The avatar size used in the timeline
const AVATAR_SIZE = 30;
// The resize method used in the timeline
const AVATAR_RESIZE_METHOD = "crop";

const ROOM_NAME = "Test room";
const OLD_AVATAR = fs.readFileSync("cypress/fixtures/riot.png");
const NEW_AVATAR = fs.readFileSync("cypress/fixtures/element.png");
const OLD_NAME = "Alan";
const NEW_NAME = "Alan (away)";

const getEventTilesWithBodies = (page: Page): Locator => {
    return page.locator(".mx_EventTile").filter({ has: page.locator(".mx_EventTile_body") });
};

const expectDisplayName = async (e: Locator, displayName: string): Promise<void> => {
    await expect(e.locator(".mx_DisambiguatedProfile_displayName")).toHaveText(displayName);
};

const expectAvatar = async (cli: Client, e: Locator, avatarUrl: string): Promise<void> => {
    const size = await e.page().evaluate((size) => size * window.devicePixelRatio, AVATAR_SIZE);
    const url = await cli.evaluate(
        (client, { avatarUrl, size, resizeMethod }) => {
            // eslint-disable-next-line no-restricted-properties
            return client.mxcUrlToHttp(avatarUrl, size, size, resizeMethod);
        },
        { avatarUrl, size, resizeMethod: AVATAR_RESIZE_METHOD },
    );
    await expect(e.locator(".mx_BaseAvatar img")).toHaveAttribute("src", url);
};

const sendEvent = async (client: Client, roomId: string, html = false): Promise<ISendEventResponse> => {
    const content = {
        msgtype: "m.text" as MsgType,
        body: "Message",
        format: undefined,
        formatted_body: undefined,
    };
    if (html) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = "<b>Message</b>";
    }
    return client.sendEvent(roomId, null, "m.room.message" as EventType, content);
};

test.describe("Timeline", () => {
    test.use({
        displayName: OLD_NAME,
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({ name: ROOM_NAME });
            await use({ roomId });
        },
    });

    let oldAvatarUrl: string;
    let newAvatarUrl: string;

    test.describe("useOnlyCurrentProfiles", () => {
        test.beforeEach(async ({ app, user }) => {
            ({ content_uri: oldAvatarUrl } = await app.client.uploadContent(OLD_AVATAR, { type: "image/png" }));
            await app.client.setAvatarUrl(oldAvatarUrl);
            ({ content_uri: newAvatarUrl } = await app.client.uploadContent(NEW_AVATAR, { type: "image/png" }));
        });

        test("should show historical profiles if disabled", async ({ page, app, room }) => {
            await app.settings.setValue("useOnlyCurrentProfiles", null, SettingLevel.ACCOUNT, false);
            await sendEvent(app.client, room.roomId);
            await app.client.setDisplayName("Alan (away)");
            await app.client.setAvatarUrl(newAvatarUrl);
            // XXX: If we send the second event too quickly, there won't be
            // enough time for the client to register the profile change
            await page.waitForTimeout(500);
            await sendEvent(app.client, room.roomId);
            await app.viewRoomByName(ROOM_NAME);

            const events = getEventTilesWithBodies(page);
            await expect(events).toHaveCount(2);
            await expectDisplayName(events.nth(0), OLD_NAME);
            await expectAvatar(app.client, events.nth(0), oldAvatarUrl);
            await expectDisplayName(events.nth(1), NEW_NAME);
            await expectAvatar(app.client, events.nth(1), newAvatarUrl);
        });

        test("should not show historical profiles if enabled", async ({ page, app, room }) => {
            await app.settings.setValue("useOnlyCurrentProfiles", null, SettingLevel.ACCOUNT, true);
            await sendEvent(app.client, room.roomId);
            await app.client.setDisplayName(NEW_NAME);
            await app.client.setAvatarUrl(newAvatarUrl);
            // XXX: If we send the second event too quickly, there won't be
            // enough time for the client to register the profile change
            await page.waitForTimeout(500);
            await sendEvent(app.client, room.roomId);
            await app.viewRoomByName(ROOM_NAME);

            const events = getEventTilesWithBodies(page);
            await expect(events).toHaveCount(2);
            for (const e of await events.all()) {
                await expectDisplayName(e, NEW_NAME);
                await expectAvatar(app.client, e, newAvatarUrl);
            }
        });
    });

    test.describe("configure room", () => {
        test("should create and configure a room on IRC layout", async ({ page, app, room }) => {
            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            await expect(
                page.locator(
                    ".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc'] .mx_GenericEventListSummary_summary",
                    { hasText: `${OLD_NAME} created and configured the room.` },
                ),
            ).toBeVisible();

            // wait for the date separator to appear to have a stable percy snapshot
            await expect(page.locator(".mx_TimelineSeparator")).toHaveText("today");

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("configured-room-irc-layout.png");
        });

        test("should have an expanded generic event list summary (GELS) on IRC layout", async ({ page, app, room }) => {
            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            await expect(
                page.locator(
                    ".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc'] .mx_GenericEventListSummary_summary",
                    { hasText: `${OLD_NAME} created and configured the room.` },
                ),
            ).toBeVisible();

            const gels = page.locator(".mx_GenericEventListSummary");
            // Click "expand" link button
            await gels.getByRole("button", { name: "Expand" }).click();
            // Assert that the "expand" link button worked
            await expect(gels.getByRole("button", { name: "Collapse" })).toBeVisible();

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-irc-layout.png", {
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            });
        });

        test("should have an expanded generic event list summary (GELS) on compact modern/group layout", async ({
            page,
            app,
            room,
        }) => {
            await page.goto(`/#/room/${room.roomId}`);

            // Set compact modern layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);

            // Wait until configuration is finished
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: `${OLD_NAME} created and configured the room.`,
                }),
            ).toBeVisible();

            const gels = page.locator(".mx_GenericEventListSummary");
            // Click "expand" link button
            await gels.getByRole("button", { name: "Expand" }).click();
            // Assert that the "expand" link button worked
            await expect(gels.getByRole("button", { name: "Collapse" })).toBeVisible();

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-modern-layout.png", {
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            });
        });

        test("should click 'collapse' on the first hovered info event line inside GELS on bubble layout", async ({
            page,
            app,
            room,
        }) => {
            // This test checks clickability of the "Collapse" link button, which had been covered with
            // MessageActionBar's safe area - https://github.com/vector-im/element-web/issues/22864

            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await expect(
                page.locator(
                    ".mx_RoomView_body .mx_GenericEventListSummary[data-layout='bubble'] .mx_GenericEventListSummary_summary",
                    { hasText: `${OLD_NAME} created and configured the room.` },
                ),
            ).toBeVisible();

            const gels = page.locator(".mx_GenericEventListSummary");
            // Click "expand" link button
            await gels.getByRole("button", { name: "Expand" }).click();
            // Assert that the "expand" link button worked
            await expect(gels.getByRole("button", { name: "Collapse" })).toBeVisible();

            // Make sure spacer is not visible on bubble layout
            await expect(
                page.locator(".mx_GenericEventListSummary[data-layout=bubble] .mx_GenericEventListSummary_spacer"),
            ).not.toBeVisible(); // See: _GenericEventListSummary.pcss

            // Save snapshot of expanded generic event list summary on bubble layout
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-bubble-layout.png", {
                // Exclude timestamp from snapshot
                mask: [page.locator(".mx_MessageTimestamp")],
            });

            // Click "collapse" link button on the first hovered info event line
            const firstTile = gels.locator(".mx_GenericEventListSummary_unstyledList .mx_EventTile_info:first-of-type");
            await firstTile.hover();
            await expect(firstTile.getByRole("toolbar", { name: "Message Actions" })).toBeVisible();
            await gels.getByRole("button", { name: "Collapse" }).click();

            // Assert that "collapse" link button worked
            await expect(gels.getByRole("button", { name: "Expand" })).toBeVisible();

            // Save snapshot of collapsed generic event list summary on bubble layout
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("collapsed-gels-bubble-layout.png", {
                mask: [page.locator(".mx_MessageTimestamp")],
            });
        });

        test("should add inline start margin to an event line on IRC layout", async ({
            page,
            app,
            room,
            axe,
            checkA11y,
        }) => {
            axe.disableRules("color-contrast");

            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            await expect(
                page.locator(
                    ".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc'] .mx_GenericEventListSummary_summary",
                    { hasText: `${OLD_NAME} created and configured the room.` },
                ),
            ).toBeVisible();

            // Click "expand" link button
            await page.locator(".mx_GenericEventListSummary").getByRole("button", { name: "Expand" }).click();

            // Check the event line has margin instead of inset property
            // cf. _EventTile.pcss
            //  --EventTile_irc_line_info-margin-inline-start
            //  = calc(var(--name-width) + var(--icon-width) + 1 * var(--right-padding))
            //  = 80 + 14 + 5 = 99px

            const firstEventLineIrc = page.locator(
                ".mx_EventTile_info[data-layout=irc]:first-of-type .mx_EventTile_line",
            );
            await expect(firstEventLineIrc).toHaveCSS("margin-inline-start", "99px");
            await expect(firstEventLineIrc).toHaveCSS("inset-inline-start", "0px");

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "event-line-inline-start-margin-irc-layout.png",
                {
                    // Exclude timestamp and read marker from snapshot
                    mask: [page.locator(".mx_MessageTimestamp")],
                    css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
                },
            );
            await checkA11y();
        });
    });

    test.describe("message displaying", () => {
        const messageEdit = async (page: Page) => {
            const line = page.locator(".mx_EventTile .mx_EventTile_line", { hasText: "Message" });
            await line.hover();
            await line.getByRole("toolbar", { name: "Message Actions" }).getByRole("button", { name: "Edit" }).click();
            await page.getByRole("textbox", { name: "Edit message" }).pressSequentially("Edit");
            await page.getByRole("textbox", { name: "Edit message" }).press("Enter");

            // Assert that the edited message and the link button are found
            // Regex patterns due to the edited date
            await expect(
                page.locator(".mx_EventTile .mx_EventTile_line", { hasText: "MessageEdit" }).getByRole("button", {
                    name: /Edited at .*? Click to view edits./,
                }),
            ).toBeVisible();
        };

        test("should align generic event list summary with messages and emote on IRC layout", async ({
            page,
            app,
            room,
        }) => {
            // This test aims to check:
            // 1. Alignment of collapsed GELS (generic event list summary) and messages
            // 2. Alignment of expanded GELS and messages
            // 3. Alignment of expanded GELS and placeholder of deleted message
            // 4. Alignment of expanded GELS, placeholder of deleted message, and emote

            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(`${OLD_NAME} created and configured the room.`),
            ).toBeVisible();

            // Send messages
            const composer = app.getComposerField();
            await composer.fill("Hello Mr. Bot");
            await composer.press("Enter");
            await composer.fill("Hello again, Mr. Bot");
            await composer.press("Enter");

            // Make sure the second message was sent
            await expect(
                page.locator(".mx_RoomView_MessageList > .mx_EventTile_last .mx_EventTile_receiptSent"),
            ).toBeVisible();

            // 1. Alignment of collapsed GELS (generic event list summary) and messages
            // Check inline start spacing of collapsed GELS
            // See: _EventTile.pcss
            // .mx_GenericEventListSummary[data-layout="irc"] > .mx_EventTile_line
            //  = var(--name-width) + var(--icon-width) + var(--MessageTimestamp-width) + 2 * var(--right-padding)
            //  = 80 + 14 + 46 + 2 * 5
            //  = 150px
            await expect(page.locator(".mx_GenericEventListSummary[data-layout=irc] > .mx_EventTile_line")).toHaveCSS(
                "padding-inline-start",
                "150px",
            );
            // Check width and spacing values of elements in .mx_EventTile, which should be equal to 150px
            // --right-padding should be applied
            for (const locator of await page.locator(".mx_EventTile > a").all()) {
                if (await locator.isVisible()) {
                    await expect(locator).toHaveCSS("margin-right", "5px");
                }
            }
            // --name-width width zero inline end margin should be applied
            for (const locator of await page.locator(".mx_EventTile .mx_DisambiguatedProfile").all()) {
                await expect(locator).toHaveCSS("width", "80px");
                await expect(locator).toHaveCSS("margin-inline-end", "0px");
            }
            // --icon-width should be applied
            for (const locator of await page.locator(".mx_EventTile .mx_EventTile_avatar > .mx_BaseAvatar").all()) {
                await expect(locator).toHaveCSS("width", "14px");
            }
            // var(--MessageTimestamp-width) should be applied
            for (const locator of await page.locator(".mx_EventTile > a").all()) {
                await expect(locator).toHaveCSS("min-width", "46px");
            }
            // Record alignment of collapsed GELS and messages on messagePanel
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "collapsed-gels-and-messages-irc-layout.png",
                {
                    // Exclude timestamp from snapshot of mx_MainSplit
                    mask: [page.locator(".mx_MessageTimestamp")],
                },
            );

            // 2. Alignment of expanded GELS and messages
            // Click "expand" link button
            await page.locator(".mx_GenericEventListSummary").getByRole("button", { name: "Expand" }).click();
            // Check inline start spacing of info line on expanded GELS
            // See: _EventTile.pcss
            // --EventTile_irc_line_info-margin-inline-start
            // = 80 + 14 + 1 * 5
            await expect(
                page.locator(".mx_EventTile[data-layout=irc].mx_EventTile_info:first-of-type .mx_EventTile_line"),
            ).toHaveCSS("margin-inline-start", "99px");
            // Record alignment of expanded GELS and messages on messagePanel
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-and-messages-irc-layout.png", {
                // Exclude timestamp from snapshot of mx_MainSplit
                mask: [page.locator(".mx_MessageTimestamp")],
            });

            // 3. Alignment of expanded GELS and placeholder of deleted message
            // Delete the second (last) message
            const lastTile = page.locator(".mx_RoomView_MessageList > .mx_EventTile_last");
            await lastTile.hover();
            await lastTile.getByRole("button", { name: "Options" }).click();
            await page.getByRole("menuitem", { name: "Remove" }).click();
            // Confirm deletion
            await page.locator(".mx_Dialog_buttons").getByRole("button", { name: "Remove" }).click();
            // Make sure the dialog was closed and the second (last) message was redacted
            await expect(page.locator(".mx_Dialog")).not.toBeVisible();
            await expect(page.locator(".mx_GenericEventListSummary .mx_EventTile_last .mx_RedactedBody")).toBeVisible();
            await expect(
                page.locator(".mx_GenericEventListSummary .mx_EventTile_last .mx_EventTile_receiptSent"),
            ).toBeVisible();
            // Record alignment of expanded GELS and placeholder of deleted message on messagePanel
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-redaction-placeholder.png", {
                // Exclude timestamp from snapshot of mx_MainSplit
                mask: [page.locator(".mx_MessageTimestamp")],
            });

            // 4. Alignment of expanded GELS, placeholder of deleted message, and emote
            // Send a emote
            await page
                .locator(".mx_RoomView_body")
                .getByRole("textbox", { name: "Send a message…" })
                .fill("/me says hello to Mr. Bot");
            await page.locator(".mx_RoomView_body").getByRole("textbox", { name: "Send a message…" }).press("Enter");
            // Check inline start margin of its avatar
            // Here --right-padding is for the avatar on the message line
            // See: _IRCLayout.pcss
            // .mx_IRCLayout .mx_EventTile_emote .mx_EventTile_avatar
            // = calc(var(--name-width) + var(--icon-width) + 1 * var(--right-padding))
            // = 80 + 14 + 1 * 5
            await expect(page.locator(".mx_EventTile_emote .mx_EventTile_avatar")).toHaveCSS("margin-left", "99px");
            // Make sure emote was sent
            await expect(page.locator(".mx_EventTile_last.mx_EventTile_emote .mx_EventTile_receiptSent")).toBeVisible();
            // Record alignment of expanded GELS, placeholder of deleted message, and emote
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("expanded-gels-emote-irc-layout.png", {
                // Exclude timestamp from snapshot of mx_MainSplit
                mask: [page.locator(".mx_MessageTimestamp")],
            });
        });

        test("should render EventTiles on IRC, modern (group), and bubble layout", async ({ page, app, room }) => {
            const screenshotOptions = {
                // Hide because flaky - See https://github.com/vector-im/element-web/issues/24957
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            };

            await sendEvent(app.client, room.roomId);
            await sendEvent(app.client, room.roomId); // check continuation
            await sendEvent(app.client, room.roomId); // check the last EventTile

            await page.goto(`/#/room/${room.roomId}`);
            const composer = app.getComposerField();
            // Send a plain text message
            await composer.fill("Hello");
            await composer.press("Enter");
            // Send a big emoji
            await composer.fill("🏀");
            await composer.press("Enter");
            // Send an inline emoji
            await composer.fill("This message has an inline emoji 👒");
            await composer.press("Enter");

            await expect(page.locator(".mx_RoomView").getByText("This message has an inline emoji 👒")).toBeVisible();

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // IRC layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(`${OLD_NAME} created and configured the room.`),
            ).toBeVisible();

            await app.scrollToBottom(page);
            await expect(
                page.locator(".mx_RoomView").getByText("This message has an inline emoji 👒"),
            ).toBeInViewport();
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "event-tiles-irc-layout.png",
                screenshotOptions,
            );

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Group/modern layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

            // Check that the last EventTile is rendered
            await app.scrollToBottom(page);
            await expect(
                page.locator(".mx_RoomView").getByText("This message has an inline emoji 👒"),
            ).toBeInViewport();
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "event-tiles-modern-layout.png",
                screenshotOptions,
            );

            // Check the same thing for compact layout
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);

            // Check that the last EventTile is rendered
            await app.scrollToBottom(page);
            await expect(
                page.locator(".mx_RoomView").getByText("This message has an inline emoji 👒"),
            ).toBeInViewport();
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "event-tiles-compact-modern-layout.png",
                screenshotOptions,
            );

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Message bubble layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

            await app.scrollToBottom(page);
            await expect(
                page.locator(".mx_RoomView").getByText("This message has an inline emoji 👒"),
            ).toBeInViewport();
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "event-tiles-bubble-layout.png",
                screenshotOptions,
            );
        });

        test("should set inline start padding to a hidden event line", async ({ page, app, room }) => {
            await sendEvent(app.client, room.roomId);
            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(`${OLD_NAME} created and configured the room.`),
            ).toBeVisible();

            // Edit message
            await messageEdit(page);

            // Click timestamp to highlight hidden event line
            await page.locator(".mx_RoomView_body .mx_EventTile_info .mx_MessageTimestamp").click();

            // should not add inline start padding to a hidden event line on IRC layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            await expect(
                page.locator(".mx_EventTile[data-layout=irc].mx_EventTile_info .mx_EventTile_line").first(),
            ).toHaveCSS("padding-inline-start", "0px");

            // Exclude timestamp and read marker from snapshot
            const screenshotOptions = {
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            };

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "hidden-event-line-zero-padding-irc-layout.png",
                screenshotOptions,
            );

            // should add inline start padding to a hidden event line on modern layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            // calc(var(--EventTile_group_line-spacing-inline-start) + 20px) = 64 + 20 = 84px
            await expect(
                page.locator(".mx_EventTile[data-layout=group].mx_EventTile_info .mx_EventTile_line").first(),
            ).toHaveCSS("padding-inline-start", "84px");

            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "hidden-event-line-padding-modern-layout.png",
                screenshotOptions,
            );
        });

        test("should click view source event toggle", async ({ page, app, room }) => {
            // This test checks:
            // 1. clickability of top left of view source event toggle
            // 2. clickability of view source toggle on IRC layout

            // Exclude timestamp from snapshot
            const screenshotOptions = {
                mask: [page.locator(".mx_MessageTimestamp")],
            };

            await sendEvent(app.client, room.roomId);
            await page.goto(`/#/room/${room.roomId}`);
            await app.settings.setValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(OLD_NAME + " created and configured the room."),
            ).toBeVisible();

            // Edit message
            await messageEdit(page);

            // 1. clickability of top left of view source event toggle

            // Click top left of the event toggle, which should not be covered by MessageActionBar's safe area
            const viewSourceEventGroup = page.locator(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent");
            await viewSourceEventGroup.hover();
            await viewSourceEventGroup
                .getByRole("button", { name: "toggle event" })
                .click({ position: { x: 0, y: 0 } });

            // Make sure the expand toggle works
            const viewSourceEventExpanded = page.locator(
                ".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent_expanded",
            );
            await viewSourceEventExpanded.hover();
            const toggleEventButton = viewSourceEventExpanded.getByRole("button", { name: "toggle event" });
            // Check size and position of toggle on expanded view source event
            // See: _ViewSourceEvent.pcss
            await expect(toggleEventButton).toHaveCSS("height", "12px"); // --ViewSourceEvent_toggle-size
            await expect(toggleEventButton).toHaveCSS("align-self", "flex-end");
            // Click again to collapse the source
            await toggleEventButton.click({ position: { x: 0, y: 0 } });

            // Make sure the collapse toggle works
            await expect(
                page.locator(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent_expanded"),
            ).not.toBeVisible();

            // 2. clickability of view source toggle on IRC layout

            // Enable IRC layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Hover the view source toggle on IRC layout
            const viewSourceEventIrc = page.locator(
                ".mx_GenericEventListSummary[data-layout=irc] .mx_EventTile .mx_ViewSourceEvent",
            );
            await viewSourceEventIrc.hover();
            await expect(viewSourceEventIrc).toMatchScreenshot(
                "hovered-hidden-event-line-irc-layout.png",
                screenshotOptions,
            );

            // Click view source event toggle
            await viewSourceEventIrc.getByRole("button", { name: "toggle event" }).click({ position: { x: 0, y: 0 } });

            // Make sure the expand toggle worked
            await expect(page.locator(".mx_EventTile[data-layout=irc] .mx_ViewSourceEvent_expanded")).toBeVisible();
        });

        test("should render file size in kibibytes on a file tile", async ({ page, room }) => {
            await page.goto(`/#/room/${room.roomId}`);
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(OLD_NAME + " created and configured the room."),
            ).toBeVisible();

            // Upload a file from the message composer
            await page
                .locator(".mx_MessageComposer_actions input[type='file']")
                .setInputFiles("cypress/fixtures/matrix-org-client-versions.json");

            // Click "Upload" button
            await page.locator(".mx_Dialog").getByRole("button", { name: "Upload" }).click();

            // Wait until the file is sent
            await expect(page.locator(".mx_RoomView_statusArea_expanded")).not.toBeVisible();
            await expect(page.locator(".mx_EventTile.mx_EventTile_last .mx_EventTile_receiptSent")).toBeVisible();

            // Assert that the file size is displayed in kibibytes (1024 bytes), not kilobytes (1000 bytes)
            // See: https://github.com/vector-im/element-web/issues/24866
            await expect(
                page.locator(".mx_EventTile_last .mx_MFileBody_info_filename").getByText(/1.12 KB/),
            ).toBeVisible();
        });

        test("should render url previews", async ({ page, app, room, axe, checkA11y }) => {
            axe.disableRules("color-contrast");

            await page.route(
                "**/_matrix/media/v3/thumbnail/matrix.org/2022-08-16_yaiSVSRIsNFfxDnV?*",
                async (route) => {
                    await route.fulfill({
                        path: "cypress/fixtures/riot.png",
                    });
                },
            );
            await page.route(
                "**/_matrix/media/v3/preview_url?url=https%3A%2F%2Fcall.element.io%2F&ts=*",
                async (route) => {
                    await route.fulfill({
                        json: {
                            "og:title": "Element Call",
                            "og:description": null,
                            "og:image:width": 48,
                            "og:image:height": 48,
                            "og:image": "mxc://matrix.org/2022-08-16_yaiSVSRIsNFfxDnV",
                            "og:image:type": "image/png",
                            "matrix:image:size": 2121,
                        },
                    });
                },
            );

            const requestPromises: Promise<any>[] = [
                page.waitForResponse("**/_matrix/media/v3/preview_url?url=https%3A%2F%2Fcall.element.io%2F&ts=*"),
                page.waitForResponse("**/_matrix/media/v3/thumbnail/matrix.org/2022-08-16_yaiSVSRIsNFfxDnV?*"),
            ];

            await app.client.sendMessage(room.roomId, "https://call.element.io/");
            await page.goto(`/#/room/${room.roomId}`);

            await expect(page.locator(".mx_LinkPreviewWidget").getByText("Element Call")).toBeVisible();
            await Promise.all(requestPromises);

            await checkA11y();

            await app.scrollToBottom(page);
            await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot("url-preview.png", {
                // Exclude timestamp and read marker from snapshot
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            });
        });

        test.describe("on search results panel", () => {
            test("should highlight search result words regardless of formatting", async ({ page, app, room }) => {
                await sendEvent(app.client, room.roomId);
                await sendEvent(app.client, room.roomId, true);
                await page.goto(`/#/room/${room.roomId}`);

                await page.locator(".mx_LegacyRoomHeader").getByRole("button", { name: "Search" }).click();

                await expect(page.locator(".mx_SearchBar")).toMatchScreenshot("search-bar-on-timeline.png");

                await page.locator(".mx_SearchBar_input").getByRole("textbox").fill("Message");
                await page.locator(".mx_SearchBar_input").getByRole("textbox").press("Enter");

                for (const locator of await page
                    .locator(".mx_EventTile:not(.mx_EventTile_contextual) .mx_EventTile_searchHighlight")
                    .all()) {
                    await expect(locator).toBeVisible();
                }
                await expect(page.locator(".mx_RoomView_searchResultsPanel")).toMatchScreenshot(
                    "highlighted-search-results.png",
                );
            });

            test("should render a fully opaque textual event", async ({ page, app, room }) => {
                const stringToSearch = "Message"; // Same with string sent with sendEvent()

                await sendEvent(app.client, room.roomId);

                await page.goto(`/#/room/${room.roomId}`);

                // Open a room setting dialog
                await page.getByRole("button", { name: "Room options" }).click();
                await page.getByRole("menuitem", { name: "Settings" }).click();

                // Set a room topic to render a TextualEvent
                await page.getByRole("textbox", { name: "Room Topic" }).type(`This is a room for ${stringToSearch}.`);
                await page.getByRole("button", { name: "Save" }).click();

                await app.closeDialog();

                // Assert that the TextualEvent is rendered
                await expect(
                    page.getByText(`${OLD_NAME} changed the topic to "This is a room for ${stringToSearch}.".`),
                ).toHaveClass(/mx_TextualEvent/);

                // Display the room search bar
                await page.locator(".mx_LegacyRoomHeader").getByRole("button", { name: "Search" }).click();

                // Search the string to display both the message and TextualEvent on search results panel
                await page.locator(".mx_SearchBar").getByRole("textbox").fill(stringToSearch);
                await page.locator(".mx_SearchBar").getByRole("textbox").press("Enter");

                // On search results panel
                const resultsPanel = page.locator(".mx_RoomView_searchResultsPanel");
                // Assert that contextual event tiles are translucent
                for (const locator of await resultsPanel.locator(".mx_EventTile.mx_EventTile_contextual").all()) {
                    await expect(locator).toHaveCSS("opacity", "0.4");
                }
                // Assert that the TextualEvent is fully opaque (visually solid).
                for (const locator of await resultsPanel.locator(".mx_EventTile .mx_TextualEvent").all()) {
                    await expect(locator).toHaveCSS("opacity", "1");
                }

                await expect(page.locator(".mx_RoomView_searchResultsPanel")).toMatchScreenshot(
                    "search-results-with-TextualEvent.png",
                );
            });
        });
    });

    test.describe("message sending", () => {
        const MESSAGE = "Hello world";
        const reply = "Reply";
        const viewRoomSendMessageAndSetupReply = async (page: Page, app: ElementAppPage, roomId: string) => {
            // View room
            await page.goto(`/#/room/${roomId}`);

            // Send a message
            const composer = app.getComposerField();
            await composer.fill(MESSAGE);
            await composer.press("Enter");

            // Reply to the message
            const lastTile = page.locator(".mx_EventTile_last");
            await expect(lastTile.getByText(MESSAGE)).toBeVisible();
            await lastTile.hover();
            await lastTile.getByRole("button", { name: "Reply", exact: true }).click();
        };

        // For clicking the reply button on the last line
        const clickButtonReply = async (page: Page): Promise<void> => {
            const lastTile = page.locator(".mx_RoomView_MessageList .mx_EventTile_last");
            await lastTile.hover();
            await lastTile.getByRole("button", { name: "Reply", exact: true }).click();
        };

        test("can reply with a text message", async ({ page, app, room }) => {
            await viewRoomSendMessageAndSetupReply(page, app, room.roomId);

            await app.getComposerField().fill(reply);
            await app.getComposerField().press("Enter");

            const eventTileLine = page.locator(".mx_RoomView_body .mx_EventTile_last .mx_EventTile_line");
            await expect(eventTileLine.locator(".mx_ReplyTile .mx_MTextBody").getByText(MESSAGE)).toBeVisible();
            await expect(eventTileLine.getByText(reply)).toHaveCount(1);
        });

        test("can reply with a voice message", async ({ page, app, room, context }) => {
            await context.grantPermissions(["microphone"]);
            await viewRoomSendMessageAndSetupReply(page, app, room.roomId);

            const composerOptions = await app.openMessageComposerOptions();
            await composerOptions.getByRole("menuitem", { name: "Voice Message" }).click();

            // Record an empty message
            await page.waitForTimeout(3000);

            const roomViewBody = page.locator(".mx_RoomView_body");
            await roomViewBody
                .locator(".mx_MessageComposer")
                .getByRole("button", { name: "Send voice message" })
                .click();

            const lastEventTileLine = roomViewBody.locator(".mx_EventTile_last .mx_EventTile_line");
            await expect(lastEventTileLine.locator(".mx_ReplyTile .mx_MTextBody").getByText(MESSAGE)).toBeVisible();

            await expect(lastEventTileLine.locator(".mx_MVoiceMessageBody")).toHaveCount(1);
        });

        test("should not be possible to send flag with regional emojis", async ({ page, app, room }) => {
            await page.goto(`/#/room/${room.roomId}`);

            // Send a message
            await app.getComposerField().pressSequentially(":regional_indicator_a");
            await page.locator(".mx_Autocomplete_Completion_title", { hasText: ":regional_indicator_a:" }).click();
            await app.getComposerField().pressSequentially(":regional_indicator_r");
            await page.locator(".mx_Autocomplete_Completion_title", { hasText: ":regional_indicator_r:" }).click();
            await app.getComposerField().pressSequentially(" :regional_indicator_z");
            await page.locator(".mx_Autocomplete_Completion_title", { hasText: ":regional_indicator_z:" }).click();
            await app.getComposerField().pressSequentially(":regional_indicator_a");
            await page.locator(".mx_Autocomplete_Completion_title", { hasText: ":regional_indicator_a:" }).click();
            await app.getComposerField().press("Enter");

            await expect(
                page.locator(
                    ".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_MTextBody .mx_EventTile_bigEmoji > *",
                ),
            ).toHaveCount(4);
        });

        test("should display a reply chain", async ({ page, app, room, homeserver }) => {
            const reply2 = "Reply again";

            await page.goto(`/#/room/${room.roomId}`);

            // Wait until configuration is finished
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(OLD_NAME + " created and configured the room."),
            ).toBeVisible();

            // Create a bot "BotBob" and invite it
            const bot = new Bot(page, homeserver, {
                displayName: "BotBob",
                autoAcceptInvites: false,
            });
            await bot.prepareClient();
            await app.client.inviteUser(room.roomId, bot.credentials.userId);
            await bot.joinRoom(room.roomId);

            // Make sure the bot joined the room
            await expect(
                page
                    .locator(".mx_GenericEventListSummary .mx_EventTile_info.mx_EventTile_last")
                    .getByText("BotBob joined the room"),
            ).toBeVisible();

            // Have bot send MESSAGE to roomId
            await bot.sendMessage(room.roomId, MESSAGE);

            // Assert that MESSAGE is found
            await expect(page.getByText(MESSAGE)).toBeVisible();

            // Reply to the message
            await clickButtonReply(page);
            await app.getComposerField().fill(reply);
            await app.getComposerField().press("Enter");

            // Make sure 'reply' was sent
            await expect(page.locator(".mx_RoomView_body .mx_EventTile_last").getByText(reply)).toBeVisible();

            // Reply again to create a replyChain
            await clickButtonReply(page);
            await app.getComposerField().fill(reply2);
            await app.getComposerField().press("Enter");

            // Assert that 'reply2' was sent
            await expect(page.locator(".mx_RoomView_body .mx_EventTile_last").getByText(reply2)).toBeVisible();

            await expect(page.locator(".mx_EventTile_last .mx_EventTile_receiptSent")).toBeVisible();

            // Exclude timestamp and read marker from snapshot
            const screenshotOptions = {
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            };

            // Check the margin value of ReplyChains of EventTile at the bottom on IRC layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            for (const locator of await page.locator(".mx_EventTile_last[data-layout='irc'] .mx_ReplyChain").all()) {
                await expect(locator).toHaveCSS("margin", "0px");
            }

            // Take a snapshot on IRC layout
            // Note that because zero margin is applied to mx_ReplyChain, the left borders of two mx_ReplyChain
            // components may seem to be connected to one.
            await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
                "event-tile-reply-chains-irc-layout.png",
                screenshotOptions,
            );

            // Check the margin value of ReplyChains of EventTile at the bottom on group/modern layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            for (const locator of await page.locator(".mx_EventTile_last[data-layout='group'] .mx_ReplyChain").all()) {
                await expect(locator).toHaveCSS("margin-bottom", "8px");
            }

            // Take a snapshot on modern layout
            await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
                "event-tile-reply-chains-irc-modern.png",
                screenshotOptions,
            );

            // Check the margin value of ReplyChains of EventTile at the bottom on group/modern compact layout
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            for (const locator of await page.locator(".mx_EventTile_last[data-layout='group'] .mx_ReplyChain").all()) {
                await expect(locator).toHaveCSS("margin-bottom", "4px");
            }

            // Take a snapshot on compact modern layout
            await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
                "event-tile-reply-chains-compact-modern-layout.png",
                screenshotOptions,
            );

            // Check the margin value of ReplyChains of EventTile at the bottom on bubble layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            for (const locator of await page.locator(".mx_EventTile_last[data-layout='bubble'] .mx_ReplyChain").all()) {
                await expect(locator).toHaveCSS("margin-bottom", "8px");
            }

            // Take a snapshot on bubble layout
            await expect(page.locator(".mx_EventTile_last")).toMatchScreenshot(
                "event-tile-reply-chains-bubble-layout.png",
                screenshotOptions,
            );
        });

        test("should send, reply, and display long strings without overflowing", async ({
            page,
            app,
            room,
            homeserver,
        }) => {
            // Max 256 characters for display name
            const LONG_STRING =
                "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut " +
                "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
                "aliquip";

            // Create a bot with a long display name
            const bot = new Bot(page, homeserver, {
                displayName: LONG_STRING,
                autoAcceptInvites: false,
            });
            await bot.prepareClient();

            // Create another room with a long name, invite the bot, and open the room
            const testRoomId = await app.client.createRoom({ name: LONG_STRING });
            await app.client.inviteUser(testRoomId, bot.credentials.userId);
            await bot.joinRoom(testRoomId);
            await page.goto(`/#/room/${testRoomId}`);

            // Wait until configuration is finished
            await expect(
                page
                    .locator(".mx_GenericEventListSummary_summary")
                    .getByText(OLD_NAME + " created and configured the room."),
            ).toBeVisible();

            // Set the display name to "LONG_STRING 2" in order to avoid a warning in Percy tests from being triggered
            // due to the generated random mxid being displayed inside the GELS summary.
            await app.client.setDisplayName(`${LONG_STRING} 2`);

            // Have the bot send a long message
            await bot.sendMessage(testRoomId, {
                body: LONG_STRING,
                msgtype: "m.text",
            });

            // Wait until the message is rendered
            await expect(
                page.locator(".mx_EventTile_last .mx_MTextBody .mx_EventTile_body").getByText(LONG_STRING),
            ).toBeVisible();

            // Reply to the message
            await clickButtonReply(page);
            await app.getComposerField().fill(reply);
            await app.getComposerField().press("Enter");

            // Make sure the reply tile is rendered
            const eventTileLine = page.locator(".mx_EventTile_last .mx_EventTile_line");
            await expect(eventTileLine.locator(".mx_ReplyTile .mx_MTextBody").getByText(LONG_STRING)).toBeVisible();

            await expect(eventTileLine.getByText(reply)).toHaveCount(1);

            // Change the viewport size
            await page.setViewportSize({ width: 1600, height: 1200 });

            // Exclude timestamp and read marker from snapshot
            const screenshotOptions = {
                mask: [page.locator(".mx_MessageTimestamp")],
                css: `
                    .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
                        display: none !important;
                    }
                `,
            };

            // Make sure the strings do not overflow on IRC layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            // Scroll to the bottom to have Percy take a snapshot of the whole viewport
            await app.scrollToBottom(page);
            // Assert that both avatar in the introduction and the last message are visible at the same time
            await expect(page.locator(".mx_NewRoomIntro .mx_BaseAvatar")).toBeVisible();
            const lastEventTileIrc = page.locator(".mx_EventTile_last[data-layout='irc']");
            await expect(lastEventTileIrc.locator(".mx_MTextBody").first()).toBeVisible();
            await expect(lastEventTileIrc.locator(".mx_EventTile_receiptSent")).toBeVisible(); // rendered at the bottom of EventTile
            // Take a snapshot in IRC layout
            await expect(page.locator(".mx_ScrollPanel")).toMatchScreenshot(
                "long-strings-with-reply-irc-layout.png",
                screenshotOptions,
            );

            // Make sure the strings do not overflow on modern layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await app.scrollToBottom(page); // Scroll again in case
            await expect(page.locator(".mx_NewRoomIntro .mx_BaseAvatar")).toBeVisible();
            const lastEventTileGroup = page.locator(".mx_EventTile_last[data-layout='group']");
            await expect(lastEventTileGroup.locator(".mx_MTextBody").first()).toBeVisible();
            await expect(lastEventTileGroup.locator(".mx_EventTile_receiptSent")).toBeVisible();
            await expect(page.locator(".mx_ScrollPanel")).toMatchScreenshot(
                "long-strings-with-reply-modern-layout.png",
                screenshotOptions,
            );

            // Make sure the strings do not overflow on bubble layout
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await app.scrollToBottom(page); // Scroll again in case
            await expect(page.locator(".mx_NewRoomIntro .mx_BaseAvatar")).toBeVisible();
            const lastEventTileBubble = page.locator(".mx_EventTile_last[data-layout='bubble']");
            await expect(lastEventTileBubble.locator(".mx_MTextBody").first()).toBeVisible();
            await expect(lastEventTileBubble.locator(".mx_EventTile_receiptSent")).toBeVisible();
            await expect(page.locator(".mx_ScrollPanel")).toMatchScreenshot(
                "long-strings-with-reply-bubble-layout.png",
                screenshotOptions,
            );
        });
    });
});
