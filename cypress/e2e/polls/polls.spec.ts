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
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import Chainable = Cypress.Chainable;

const hidePercyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

describe("Polls", () => {
    let homeserver: HomeserverInstance;

    type CreatePollOptions = {
        title: string;
        options: string[];
    };
    const createPoll = ({ title, options }: CreatePollOptions) => {
        if (options.length < 2) {
            throw new Error("Poll must have at least two options");
        }
        cy.get(".mx_PollCreateDialog").within((pollCreateDialog) => {
            cy.findByRole("textbox", { name: "Question or topic" }).type(title);

            options.forEach((option, index) => {
                const optionId = `#pollcreate_option_${index}`;

                // click 'add option' button if needed
                if (pollCreateDialog.find(optionId).length === 0) {
                    cy.findByRole("button", { name: "Add option" }).scrollIntoView().click();
                }
                cy.get(optionId).scrollIntoView().type(option);
            });
        });
        cy.get(".mx_Dialog").within(() => {
            cy.findByRole("button", { name: "Create Poll" }).click();
        });
    };

    const getPollTile = (pollId: string): Chainable<JQuery> => {
        return cy.get(`.mx_EventTile[data-scroll-tokens="${pollId}"]`);
    };

    const getPollOption = (pollId: string, optionText: string): Chainable<JQuery> => {
        return getPollTile(pollId).contains(".mx_PollOption .mx_StyledRadioButton", optionText);
    };

    const expectPollOptionVoteCount = (pollId: string, optionText: string, votes: number): void => {
        getPollOption(pollId, optionText).within(() => {
            cy.get(".mx_PollOption_optionVoteCount").should("contain", `${votes} vote`);
        });
    };

    const botVoteForOption = (bot: MatrixClient, roomId: string, pollId: string, optionText: string): void => {
        getPollOption(pollId, optionText).within((ref) => {
            cy.findByRole("radio")
                .invoke("attr", "value")
                .then((optionId) => {
                    // We can't use the js-sdk types for this stuff directly, so manually construct the event.
                    bot.sendEvent(roomId, "org.matrix.msc3381.poll.response", {
                        "m.relates_to": {
                            rel_type: "m.reference",
                            event_id: pollId,
                        },
                        "org.matrix.msc3381.poll.response": {
                            answers: [optionId],
                        },
                    });
                });
        });
    };

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

    it("should be creatable and votable", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.inviteUser(roomId, bot.getUserId());
            cy.visit("/#/room/" + roomId);
            // wait until Bob joined
            cy.findByText("BotBob joined the room").should("exist");
        });

        cy.openMessageComposerOptions().within(() => {
            cy.findByRole("menuitem", { name: "Poll" }).click();
        });

        // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24688
        //cy.get(".mx_CompoundDialog").percySnapshotElement("Polls Composer");

        const pollParams = {
            title: "Does the polls feature work?",
            // Since we're going to take a screenshot anyways, we include some
            // non-ASCII characters here to stress test the app's font config
            // while we're at it.
            options: ["Yes", "Noo⃐o⃑o⃩o⃪o⃫o⃬o⃭o⃮o⃯", "のらねこ Maybe?"],
        };
        createPoll(pollParams);

        // Wait for message to send, get its ID and save as @pollId
        cy.contains(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", pollParams.title)
            .invoke("attr", "data-scroll-tokens")
            .as("pollId");

        cy.get<string>("@pollId").then((pollId) => {
            getPollTile(pollId).percySnapshotElement("Polls Timeline tile - no votes", { percyCSS: hidePercyCSS });

            // Bot votes 'Maybe' in the poll
            botVoteForOption(bot, roomId, pollId, pollParams.options[2]);

            // no votes shown until I vote, check bots vote has arrived
            cy.get(".mx_MPollBody_totalVotes").within(() => {
                cy.findByText("1 vote cast. Vote to see the results");
            });

            // vote 'Maybe'
            getPollOption(pollId, pollParams.options[2]).click("topLeft");
            // both me and bot have voted Maybe
            expectPollOptionVoteCount(pollId, pollParams.options[2], 2);

            // change my vote to 'Yes'
            getPollOption(pollId, pollParams.options[0]).click("topLeft");

            // 1 vote for yes
            expectPollOptionVoteCount(pollId, pollParams.options[0], 1);
            // 1 vote for maybe
            expectPollOptionVoteCount(pollId, pollParams.options[2], 1);

            // Bot updates vote to 'No'
            botVoteForOption(bot, roomId, pollId, pollParams.options[1]);

            // 1 vote for yes
            expectPollOptionVoteCount(pollId, pollParams.options[0], 1);
            // 1 vote for no
            expectPollOptionVoteCount(pollId, pollParams.options[0], 1);
            // 0 for maybe
            expectPollOptionVoteCount(pollId, pollParams.options[2], 0);
        });
    });

    it("should be editable from context menu if no votes have been cast", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.inviteUser(roomId, bot.getUserId());
            cy.visit("/#/room/" + roomId);
        });

        cy.openMessageComposerOptions().within(() => {
            cy.findByRole("menuitem", { name: "Poll" }).click();
        });

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"],
        };
        createPoll(pollParams);

        // Wait for message to send, get its ID and save as @pollId
        cy.get(".mx_RoomView_body .mx_EventTile")
            .contains(".mx_EventTile[data-scroll-tokens]", pollParams.title)
            .invoke("attr", "data-scroll-tokens")
            .as("pollId");

        cy.get<string>("@pollId").then((pollId) => {
            // Open context menu
            getPollTile(pollId).rightclick();

            // Select edit item
            cy.findByRole("menuitem", { name: "Edit" }).click();

            // Expect poll editing dialog
            cy.get(".mx_PollCreateDialog");
        });
    });

    it("should not be editable from context menu if votes have been cast", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.inviteUser(roomId, bot.getUserId());
            cy.visit("/#/room/" + roomId);
        });

        cy.openMessageComposerOptions().within(() => {
            cy.findByRole("menuitem", { name: "Poll" }).click();
        });

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"],
        };
        createPoll(pollParams);

        // Wait for message to send, get its ID and save as @pollId
        cy.get(".mx_RoomView_body .mx_EventTile")
            .contains(".mx_EventTile[data-scroll-tokens]", pollParams.title)
            .invoke("attr", "data-scroll-tokens")
            .as("pollId");

        cy.get<string>("@pollId").then((pollId) => {
            // Bot votes 'Maybe' in the poll
            botVoteForOption(bot, roomId, pollId, pollParams.options[2]);

            // wait for bot's vote to arrive
            cy.get(".mx_MPollBody_totalVotes").should("contain", "1 vote cast");

            // Open context menu
            getPollTile(pollId).rightclick();

            // Select edit item
            cy.findByRole("menuitem", { name: "Edit" }).click();

            // Expect error dialog
            cy.get(".mx_ErrorDialog");
        });
    });

    it("should be displayed correctly in thread panel", () => {
        let botBob: MatrixClient;
        let botCharlie: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            botBob = _bot;
        });
        cy.getBot(homeserver, { displayName: "BotCharlie" }).then((_bot) => {
            botCharlie = _bot;
        });

        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.inviteUser(roomId, botBob.getUserId());
            cy.inviteUser(roomId, botCharlie.getUserId());
            cy.visit("/#/room/" + roomId);
            // wait until the bots joined
            cy.findByText("BotBob and one other were invited and joined", { timeout: 10000 }).should("exist");
        });

        cy.openMessageComposerOptions().within(() => {
            cy.findByRole("menuitem", { name: "Poll" }).click();
        });

        const pollParams = {
            title: "Does the polls feature work?",
            options: ["Yes", "No", "Maybe"],
        };
        createPoll(pollParams);

        // Wait for message to send, get its ID and save as @pollId
        cy.contains(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", pollParams.title)
            .invoke("attr", "data-scroll-tokens")
            .as("pollId");

        cy.get<string>("@pollId").then((pollId) => {
            // Bob starts thread on the poll
            botBob.sendMessage(roomId, pollId, {
                body: "Hello there",
                msgtype: "m.text",
            });

            // open the thread summary
            cy.findByRole("button", { name: "Open thread" }).click();

            // Bob votes 'Maybe' in the poll
            botVoteForOption(botBob, roomId, pollId, pollParams.options[2]);
            // Charlie votes 'No'
            botVoteForOption(botCharlie, roomId, pollId, pollParams.options[1]);

            // no votes shown until I vote, check votes have arrived in main tl
            cy.get(".mx_RoomView_body .mx_MPollBody_totalVotes").within(() => {
                cy.findByText("2 votes cast. Vote to see the results").should("exist");
            });
            // and thread view
            cy.get(".mx_ThreadView .mx_MPollBody_totalVotes").within(() => {
                cy.findByText("2 votes cast. Vote to see the results").should("exist");
            });

            // Take snapshots of poll on ThreadView
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.get(".mx_ThreadView .mx_EventTile[data-layout='bubble']").should("be.visible");
            cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with a poll on bubble layout", {
                percyCSS: hidePercyCSS,
            });
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_ThreadView .mx_EventTile[data-layout='group']").should("be.visible");
            cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with a poll on group layout", {
                percyCSS: hidePercyCSS,
            });

            cy.get(".mx_RoomView_body").within(() => {
                // vote 'Maybe' in the main timeline poll
                getPollOption(pollId, pollParams.options[2]).click("topLeft");
                // both me and bob have voted Maybe
                expectPollOptionVoteCount(pollId, pollParams.options[2], 2);
            });

            cy.get(".mx_ThreadView").within(() => {
                // votes updated in thread view too
                expectPollOptionVoteCount(pollId, pollParams.options[2], 2);
                // change my vote to 'Yes'
                getPollOption(pollId, pollParams.options[0]).click("topLeft");
            });

            // Bob updates vote to 'No'
            botVoteForOption(botBob, roomId, pollId, pollParams.options[1]);

            // me: yes, bob: no, charlie: no
            const expectVoteCounts = () => {
                // I voted yes
                expectPollOptionVoteCount(pollId, pollParams.options[0], 1);
                // Bob and Charlie voted no
                expectPollOptionVoteCount(pollId, pollParams.options[1], 2);
                // 0 for maybe
                expectPollOptionVoteCount(pollId, pollParams.options[2], 0);
            };

            // check counts are correct in main timeline tile
            cy.get(".mx_RoomView_body").within(() => {
                expectVoteCounts();
            });
            // and in thread view tile
            cy.get(".mx_ThreadView").within(() => {
                expectVoteCounts();
            });
        });
    });
});
