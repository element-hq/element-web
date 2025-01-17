/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import type { Locator, Page } from "@playwright/test";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Polls", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3492");

    type CreatePollOptions = {
        title: string;
        options: string[];
    };
    const createPoll = async (page: Page, { title, options }: CreatePollOptions) => {
        if (options.length < 2) {
            throw new Error("Poll must have at least two options");
        }
        const dialog = page.locator(".mx_PollCreateDialog");
        await dialog.getByRole("textbox", { name: "Question or topic" }).fill(title);
        for (const [index, value] of options.entries()) {
            const optionIdLocator = dialog.locator(`#pollcreate_option_${index}`);
            // click 'add option' button if needed
            if ((await optionIdLocator.count()) === 0) {
                const button = dialog.getByRole("button", { name: "Add option" });
                await button.scrollIntoViewIfNeeded();
                await button.click();
            }
            await optionIdLocator.scrollIntoViewIfNeeded();
            await optionIdLocator.fill(value);
        }
        await page.locator(".mx_Dialog").getByRole("button", { name: "Create Poll" }).click();
    };

    const getPollTile = (page: Page, pollId: string, optLocator?: Locator): Locator => {
        return (optLocator ?? page).locator(`.mx_EventTile[data-scroll-tokens="${pollId}"]`);
    };

    const getPollOption = (page: Page, pollId: string, optionText: string, optLocator?: Locator): Locator => {
        return getPollTile(page, pollId, optLocator)
            .locator(".mx_PollOption .mx_StyledRadioButton")
            .filter({ hasText: optionText });
    };

    const expectPollOptionVoteCount = async (
        page: Page,
        pollId: string,
        optionText: string,
        votes: number,
        optLocator?: Locator,
    ): Promise<void> => {
        await expect(
            getPollOption(page, pollId, optionText, optLocator).locator(".mx_PollOption_optionVoteCount"),
        ).toContainText(`${votes} vote`);
    };

    const botVoteForOption = async (
        page: Page,
        bot: Bot,
        roomId: string,
        pollId: string,
        optionText: string,
    ): Promise<void> => {
        const locator = getPollOption(page, pollId, optionText);
        const optionId = await locator.first().getByRole("radio").getAttribute("value");

        // We can't use the js-sdk types for this stuff directly, so manually construct the event.
        await bot.sendEvent(roomId, null, "org.matrix.msc3381.poll.response", {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollId,
            },
            "org.matrix.msc3381.poll.response": {
                answers: [optionId],
            },
        });
    };

    test.use({
        displayName: "Tom",
        botCreateOpts: { displayName: "BotBob" },
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            // Collapse left panel for these tests
            window.localStorage.setItem("mx_lhs_size", "0");
        });
    });

    test("should be creatable and votable", { tag: "@screenshot" }, async ({ page, app, bot, user }) => {
        const roomId: string = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials.userId);
        await page.goto("/#/room/" + roomId);
        // wait until Bob joined
        await expect(page.getByText("BotBob joined the room")).toBeAttached();

        const locator = await app.openMessageComposerOptions();
        await locator.getByRole("menuitem", { name: "Poll" }).click();

        // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24688
        //cy.get(".mx_CompoundDialog").percySnapshotElement("Polls Composer");

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe?"],
        };
        await createPoll(page, pollParams);

        // Wait for message to send, get its ID and save as @pollId
        const pollId = await page
            .locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: pollParams.title })
            .getAttribute("data-scroll-tokens");
        await expect(getPollTile(page, pollId)).toMatchScreenshot("Polls_Timeline_tile_no_votes.png", {
            mask: [page.locator(".mx_MessageTimestamp")],
        });

        // Bot votes 'Maybe' in the poll
        await botVoteForOption(page, bot, roomId, pollId, pollParams.options[2]);

        // no votes shown until I vote, check bots vote has arrived
        await expect(
            page.locator(".mx_MPollBody_totalVotes").getByText("1 vote cast. Vote to see the results"),
        ).toBeAttached();

        // vote 'Maybe'
        await getPollOption(page, pollId, pollParams.options[2]).click();
        // both me and bot have voted Maybe
        await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 2);

        // change my vote to 'Yes'
        await getPollOption(page, pollId, pollParams.options[0]).click();

        // 1 vote for yes
        await expectPollOptionVoteCount(page, pollId, pollParams.options[0], 1);
        // 1 vote for maybe
        await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 1);

        // Bot updates vote to 'No'
        await botVoteForOption(page, bot, roomId, pollId, pollParams.options[1]);

        // 1 vote for yes
        await expectPollOptionVoteCount(page, pollId, pollParams.options[0], 1);
        // 1 vote for no
        await expectPollOptionVoteCount(page, pollId, pollParams.options[0], 1);
        // 0 for maybe
        await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 0);
    });

    test("should be editable from context menu if no votes have been cast", async ({ page, app, user, bot }) => {
        const roomId: string = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials.userId);
        await page.goto("/#/room/" + roomId);

        const locator = await app.openMessageComposerOptions();
        await locator.getByRole("menuitem", { name: "Poll" }).click();

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"],
        };
        await createPoll(page, pollParams);

        // Wait for message to send, get its ID and save as @pollId
        const pollId = await page
            .locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: pollParams.title })
            .getAttribute("data-scroll-tokens");

        // Open context menu
        await getPollTile(page, pollId).click({ button: "right" });

        // Select edit item
        await page.getByRole("menuitem", { name: "Edit" }).click();

        // Expect poll editing dialog
        await expect(page.locator(".mx_PollCreateDialog")).toBeAttached();
    });

    test("should not be editable from context menu if votes have been cast", async ({ page, app, user, bot }) => {
        const roomId: string = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials.userId);
        await page.goto("/#/room/" + roomId);

        const locator = await app.openMessageComposerOptions();
        await locator.getByRole("menuitem", { name: "Poll" }).click();

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"],
        };
        await createPoll(page, pollParams);

        // Wait for message to send, get its ID and save as @pollId
        const pollId = await page
            .locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: pollParams.title })
            .getAttribute("data-scroll-tokens");

        // Bot votes 'Maybe' in the poll
        await botVoteForOption(page, bot, roomId, pollId, pollParams.options[2]);

        // wait for bot's vote to arrive
        await expect(page.locator(".mx_MPollBody_totalVotes")).toContainText("1 vote cast");

        // Open context menu
        await getPollTile(page, pollId).click({ button: "right" });

        // Select edit item
        await page.getByRole("menuitem", { name: "Edit" }).click();

        // Expect poll editing dialog
        await expect(page.locator(".mx_ErrorDialog")).toBeAttached();
    });

    test(
        "should be displayed correctly in thread panel",
        { tag: "@screenshot" },
        async ({ page, app, user, bot, homeserver }) => {
            const botCharlie = new Bot(page, homeserver, { displayName: "BotCharlie" });
            await botCharlie.prepareClient();

            const roomId: string = await app.client.createRoom({});
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await app.client.inviteUser(roomId, botCharlie.credentials.userId);
            await page.goto("/#/room/" + roomId);

            // wait until the bots joined
            await expect(page.getByText("BotBob and one other were invited and joined")).toBeAttached({
                timeout: 10000,
            });

            const locator = await app.openMessageComposerOptions();
            await locator.getByRole("menuitem", { name: "Poll" }).click();

            const pollParams = {
                title: "Does the polls feature work?",
                options: ["Yes", "No", "Maybe"],
            };
            await createPoll(page, pollParams);

            // Wait for message to send, get its ID and save as @pollId
            const pollId = await page
                .locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]")
                .filter({ hasText: pollParams.title })
                .getAttribute("data-scroll-tokens");

            // Bob starts thread on the poll
            await bot.sendMessage(
                roomId,
                {
                    body: "Hello there",
                    msgtype: "m.text",
                },
                pollId,
            );

            // open the thread summary
            await page.getByRole("button", { name: "Open thread" }).click();

            // Bob votes 'Maybe' in the poll
            await botVoteForOption(page, bot, roomId, pollId, pollParams.options[2]);

            // Charlie votes 'No'
            await botVoteForOption(page, botCharlie, roomId, pollId, pollParams.options[1]);

            // no votes shown until I vote, check votes have arrived in main tl
            await expect(
                page
                    .locator(".mx_RoomView_body .mx_MPollBody_totalVotes")
                    .getByText("2 votes cast. Vote to see the results"),
            ).toBeAttached();

            // and thread view
            await expect(
                page
                    .locator(".mx_ThreadView .mx_MPollBody_totalVotes")
                    .getByText("2 votes cast. Vote to see the results"),
            ).toBeAttached();

            // Take snapshots of poll on ThreadView
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await expect(page.locator(".mx_ThreadView .mx_EventTile[data-layout='bubble']").first()).toBeVisible();
            await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
                "ThreadView_with_a_poll_on_bubble_layout.png",
                {
                    mask: [page.locator(".mx_MessageTimestamp")],
                },
            );

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await expect(page.locator(".mx_ThreadView .mx_EventTile[data-layout='group']").first()).toBeVisible();

            await expect(page.locator(".mx_ThreadView")).toMatchScreenshot(
                "ThreadView_with_a_poll_on_group_layout.png",
                {
                    mask: [page.locator(".mx_MessageTimestamp")],
                },
            );

            const roomViewLocator = page.locator(".mx_RoomView_body");
            // vote 'Maybe' in the main timeline poll
            await getPollOption(page, pollId, pollParams.options[2], roomViewLocator).click();
            // both me and bob have voted Maybe
            await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 2, roomViewLocator);

            const threadViewLocator = page.locator(".mx_ThreadView");
            // votes updated in thread view too
            await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 2, threadViewLocator);
            // change my vote to 'Yes'
            await getPollOption(page, pollId, pollParams.options[0], threadViewLocator).click();

            // Bob updates vote to 'No'
            await botVoteForOption(page, bot, roomId, pollId, pollParams.options[1]);

            // me: yes, bob: no, charlie: no
            const expectVoteCounts = async (optLocator: Locator) => {
                // I voted yes
                await expectPollOptionVoteCount(page, pollId, pollParams.options[0], 1, optLocator);
                // Bob and Charlie voted no
                await expectPollOptionVoteCount(page, pollId, pollParams.options[1], 2, optLocator);
                // 0 for maybe
                await expectPollOptionVoteCount(page, pollId, pollParams.options[2], 0, optLocator);
            };

            // check counts are correct in main timeline tile
            await expectVoteCounts(page.locator(".mx_RoomView_body"));

            // and in thread view tile
            await expectVoteCounts(page.locator(".mx_ThreadView"));
        },
    );
});
