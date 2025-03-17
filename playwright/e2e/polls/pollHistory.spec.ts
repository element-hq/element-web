/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { test, expect } from "../../element-web-test";
import type { Bot } from "../../pages/bot";
import type { Client } from "../../pages/client";
import { type ElementAppPage } from "../../pages/ElementAppPage";

test.describe("Poll history", () => {
    type CreatePollOptions = {
        title: string;
        options: {
            "id": string;
            "org.matrix.msc1767.text": string;
        }[];
    };
    const createPoll = async (createOptions: CreatePollOptions, roomId: string, client: Client) => {
        return client.sendEvent(roomId, null, "org.matrix.msc3381.poll.start", {
            "org.matrix.msc3381.poll.start": {
                question: {
                    "org.matrix.msc1767.text": createOptions.title,
                    "body": createOptions.title,
                    "msgtype": "m.text",
                },
                kind: "org.matrix.msc3381.poll.disclosed",
                max_selections: 1,
                answers: createOptions.options,
            },
            "org.matrix.msc1767.text": "poll fallback text",
        });
    };

    const botVoteForOption = async (bot: Bot, roomId: string, pollId: string, optionId: string): Promise<void> => {
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

    const endPoll = async (bot: Bot, roomId: string, pollId: string): Promise<void> => {
        // We can't use the js-sdk types for this stuff directly, so manually construct the event.
        await bot.sendEvent(roomId, null, "org.matrix.msc3381.poll.end", {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollId,
            },
            "org.matrix.msc1767.text": "The poll has ended",
        });
    };

    async function openPollHistory(app: ElementAppPage): Promise<void> {
        const { page } = app;
        await app.toggleRoomInfoPanel();
        await page.locator(".mx_RoomSummaryCard").getByRole("menuitem", { name: "Polls" }).click();
    }

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

    test("Should display active and past polls", async ({ page, app, user, bot }) => {
        const pollParams1 = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"].map((option) => ({
                "id": option,
                "org.matrix.msc1767.text": option,
            })),
        };

        const pollParams2 = {
            title: "Which way",
            options: ["Left", "Right"].map((option) => ({
                "id": option,
                "org.matrix.msc1767.text": option,
            })),
        };

        const roomId = await app.client.createRoom({});

        await app.client.inviteUser(roomId, bot.credentials.userId);
        await page.goto("/#/room/" + roomId);
        // wait until Bob joined
        await expect(page.getByText("BotBob joined the room")).toBeAttached();

        // active poll
        const { event_id: pollId1 } = await createPoll(pollParams1, roomId, bot);
        await botVoteForOption(bot, roomId, pollId1, pollParams1.options[1].id);

        // ended poll
        const { event_id: pollId2 } = await createPoll(pollParams2, roomId, bot);
        await botVoteForOption(bot, roomId, pollId2, pollParams1.options[1].id);
        await endPoll(bot, roomId, pollId2);

        await openPollHistory(app);

        // these polls are also in the timeline
        // focus on the poll history dialog
        const dialog = page.locator(".mx_Dialog");

        // active poll is in active polls list
        // open poll detail
        await dialog.getByText(pollParams1.title).click();
        await dialog.getByText("Yes").click();
        // vote in the poll
        await expect(dialog.getByTestId("totalVotes").getByText("Based on 2 votes")).toBeAttached();
        // navigate back to list
        await dialog.locator(".mx_PollHistory_header").getByRole("button", { name: "Active polls" }).click();

        // go to past polls list
        await dialog.getByText("Past polls").click();

        await expect(dialog.getByText(pollParams2.title)).toBeAttached();

        // end poll1 while dialog is open
        await endPoll(bot, roomId, pollId1);

        await expect(dialog.getByText(pollParams2.title)).toBeAttached();
        await expect(dialog.getByText(pollParams1.title)).toBeAttached();
        await dialog.getByText("Active polls").click();

        // no more active polls
        await expect(page.getByText("There are no active polls in this room")).toBeAttached();
    });
});
