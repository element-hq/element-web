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

/// <reference types="cypress" />

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { MatrixClient } from "../../global";

describe("Poll history", () => {
    let homeserver: HomeserverInstance;

    type CreatePollOptions = {
        title: string;
        options: {
            "id": string;
            "org.matrix.msc1767.text": string;
        }[];
    };
    const createPoll = async ({ title, options }: CreatePollOptions, roomId, client: MatrixClient) => {
        return await client.sendEvent(roomId, "org.matrix.msc3381.poll.start", {
            "org.matrix.msc3381.poll.start": {
                question: {
                    "org.matrix.msc1767.text": title,
                    "body": title,
                    "msgtype": "m.text",
                },
                kind: "org.matrix.msc3381.poll.disclosed",
                max_selections: 1,
                answers: options,
            },
            "org.matrix.msc1767.text": "poll fallback text",
        });
    };

    const botVoteForOption = async (
        bot: MatrixClient,
        roomId: string,
        pollId: string,
        optionId: string,
    ): Promise<void> => {
        // We can't use the js-sdk types for this stuff directly, so manually construct the event.
        await bot.sendEvent(roomId, "org.matrix.msc3381.poll.response", {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollId,
            },
            "org.matrix.msc3381.poll.response": {
                answers: [optionId],
            },
        });
    };

    const endPoll = async (bot: MatrixClient, roomId: string, pollId: string): Promise<void> => {
        // We can't use the js-sdk types for this stuff directly, so manually construct the event.
        await bot.sendEvent(roomId, "org.matrix.msc3381.poll.end", {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollId,
            },
            "org.matrix.msc1767.text": "The poll has ended",
        });
    };

    function openPollHistory(): void {
        cy.findByRole("button", { name: "Room info" }).click();
        cy.get(".mx_RoomSummaryCard").within(() => {
            cy.findByRole("button", { name: "Poll history" }).click();
        });
    }

    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Tom");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("Should display active and past polls", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            bot = _bot;
        });

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

        cy.createRoom({}).as("roomId");

        cy.get<string>("@roomId").then((roomId) => {
            cy.inviteUser(roomId, bot.getUserId());
            cy.visit("/#/room/" + roomId);
            // wait until Bob joined
            cy.findByText("BotBob joined the room").should("exist");
        });

        // active poll
        cy.get<string>("@roomId")
            .then(async (roomId) => {
                const { event_id: pollId } = await createPoll(pollParams1, roomId, bot);
                await botVoteForOption(bot, roomId, pollId, pollParams1.options[1].id);
                return pollId;
            })
            .as("pollId1");

        // ended poll
        cy.get<string>("@roomId")
            .then(async (roomId) => {
                const { event_id: pollId } = await createPoll(pollParams2, roomId, bot);
                await botVoteForOption(bot, roomId, pollId, pollParams1.options[1].id);
                await endPoll(bot, roomId, pollId);
                return pollId;
            })
            .as("pollId2");

        openPollHistory();

        // these polls are also in the timeline
        // focus on the poll history dialog
        cy.get(".mx_Dialog").within(() => {
            // active poll is in active polls list
            // open poll detail
            cy.findByText(pollParams1.title).click();

            // vote in the poll
            cy.findByText("Yes").click();
            cy.findByTestId("totalVotes").within(() => {
                cy.findByText("Based on 2 votes");
            });

            // navigate back to list
            cy.get(".mx_PollHistory_header").within(() => {
                cy.findByRole("button", { name: "Active polls" }).click();
            });

            // go to past polls list
            cy.findByText("Past polls").click();

            cy.findByText(pollParams2.title).should("exist");
        });

        // end poll1 while dialog is open
        cy.all([cy.get<string>("@roomId"), cy.get<string>("@pollId1")]).then(async ([roomId, pollId]) => {
            return endPoll(bot, roomId, pollId);
        });

        cy.get(".mx_Dialog").within(() => {
            // both ended polls are in past polls list
            cy.findByText(pollParams2.title).should("exist");
            cy.findByText(pollParams1.title).should("exist");

            cy.findByText("Active polls").click();

            // no more active polls
            cy.findByText("There are no active polls in this room").should("exist");
        });
    });
});
