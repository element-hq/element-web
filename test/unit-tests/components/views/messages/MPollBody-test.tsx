/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, type RenderResult, waitForElementToBeRemoved, waitFor } from "jest-matrix-react";
import {
    MatrixEvent,
    Relations,
    M_POLL_KIND_DISCLOSED,
    M_POLL_KIND_UNDISCLOSED,
    M_POLL_RESPONSE,
    M_POLL_START,
    type PollStartEventContent,
    type PollAnswer,
    M_TEXT,
} from "matrix-js-sdk/src/matrix";

import MPollBody, {
    allVotes,
    findTopAnswer,
    isPollEnded,
} from "../../../../../src/components/views/messages/MPollBody";
import { type IBodyProps } from "../../../../../src/components/views/messages/IBodyProps";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    makePollEndEvent,
    mockClientMethodsUser,
    setupRoomWithPollEvents,
} from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { type RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { type MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import * as languageHandler from "../../../../../src/languageHandler";

const CHECKED = "mx_PollOption_checked";
const userId = "@me:example.com";

const mockClient = getMockClientWithEventEmitter({
    ...mockClientMethodsUser(userId),
    sendEvent: jest.fn().mockReturnValue(Promise.resolve({ event_id: "fake_send_id" })),
    getRoom: jest.fn(),
    decryptEventIfNeeded: jest.fn().mockResolvedValue(true),
    relations: jest.fn(),
});

describe("MPollBody", () => {
    beforeEach(() => {
        mockClient.sendEvent.mockClear();

        mockClient.getRoom.mockReturnValue(null);
        mockClient.relations.mockResolvedValue({ events: [] });
        jest.spyOn(languageHandler, "getUserLanguage").mockReturnValue("en-GB");
    });

    it("finds no votes if there are none", () => {
        expect(allVotes(newVoteRelations([]))).toEqual([]);
    });

    it("renders a loader while responses are still loading", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        // render without waiting for responses
        const renderResult = await newMPollBody(votes, [], undefined, undefined, false);

        // spinner rendered
        expect(renderResult.getByTestId("spinner")).toBeInTheDocument();
    });

    it("renders no votes if none were made", async () => {
        const votes: MatrixEvent[] = [];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("");
        expect(votesCount(renderResult, "poutine")).toBe("");
        expect(votesCount(renderResult, "italian")).toBe("");
        expect(votesCount(renderResult, "wings")).toBe("");
        await waitFor(() => expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("No votes cast"));
        expect(renderResult.getByText("What should we order for the party?")).toBeTruthy();
    });

    it("finds votes from multiple people", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("2 votes");
        expect(votesCount(renderResult, "poutine")).toBe("1 vote");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 4 votes");
    });

    it("ignores end poll events from unauthorised users", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const ends = [newPollEndEvent("@notallowed:example.com", 12)];
        const renderResult = await newMPollBody(votes, ends);

        // Even though an end event was sent, we render the poll as unfinished
        // because this person is not allowed to send these events
        expect(votesCount(renderResult, "pizza")).toBe("2 votes");
        expect(votesCount(renderResult, "poutine")).toBe("1 vote");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 4 votes");
    });

    it("hides scores if I have not voted", async () => {
        const votes = [
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("");
        expect(votesCount(renderResult, "poutine")).toBe("");
        expect(votesCount(renderResult, "italian")).toBe("");
        expect(votesCount(renderResult, "wings")).toBe("");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("4 votes cast. Vote to see the results");
    });

    it("hides a single vote if I have not voted", async () => {
        const votes = [responseEvent("@alice:example.com", "pizza")];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("");
        expect(votesCount(renderResult, "poutine")).toBe("");
        expect(votesCount(renderResult, "italian")).toBe("");
        expect(votesCount(renderResult, "wings")).toBe("");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("1 vote cast. Vote to see the results");
    });

    it("takes someone's most recent vote if they voted several times", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "wings", 20), // latest me
            responseEvent("@qbert:example.com", "pizza", 14),
            responseEvent("@qbert:example.com", "poutine", 16), // latest qbert
            responseEvent("@qbert:example.com", "wings", 15),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("1 vote");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 2 votes");
    });

    it("uses my local vote", async () => {
        // Given I haven't voted
        const votes = [
            responseEvent("@nf:example.com", "pizza", 15),
            responseEvent("@fg:example.com", "pizza", 15),
            responseEvent("@hi:example.com", "pizza", 15),
        ];
        const renderResult = await newMPollBody(votes);

        // When I vote for Italian
        clickOption(renderResult, "italian");

        // My vote is counted
        expect(votesCount(renderResult, "pizza")).toBe("3 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("1 vote");
        expect(votesCount(renderResult, "wings")).toBe("0 votes");

        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 4 votes");
    });

    it("overrides my other votes with my local vote", async () => {
        // Given two of us have voted for Italian
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "poutine", 13),
            responseEvent("@me:example.com", "italian", 14),
            responseEvent("@nf:example.com", "italian", 15),
        ];
        const renderResult = await newMPollBody(votes);

        // When I click Wings
        clickOption(renderResult, "wings");

        // Then my vote is counted for Wings, and not for Italian
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("1 vote");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");

        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 2 votes");

        // And my vote is highlighted
        expect(voteButton(renderResult, "wings").className.includes(CHECKED)).toBe(true);
        expect(voteButton(renderResult, "italian").className.includes(CHECKED)).toBe(false);
    });

    it("cancels my local vote if another comes in", async () => {
        // Given I voted locally
        const votes = [responseEvent("@me:example.com", "pizza", 100)];
        const mxEvent = new MatrixEvent({
            type: M_POLL_START.name,
            event_id: "$mypoll",
            room_id: "#myroom:example.com",
            content: newPollStart(undefined, undefined, true),
        });
        const props = getMPollBodyPropsFromEvent(mxEvent);
        const room = await setupRoomWithPollEvents([mxEvent], votes, [], mockClient);
        const renderResult = renderMPollBodyWithWrapper(props);
        // wait for /relations promise to resolve
        await flushPromises();
        clickOption(renderResult, "pizza");

        // When a new vote from me comes in
        await act(() => room.processPollEvents([responseEvent("@me:example.com", "wings", 101)]));

        // Then the new vote is counted, not the old one
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");

        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 1 vote");
    });

    it("doesn't cancel my local vote if someone else votes", async () => {
        // Given I voted locally
        const votes = [responseEvent("@me:example.com", "pizza")];
        const mxEvent = new MatrixEvent({
            type: M_POLL_START.name,
            event_id: "$mypoll",
            room_id: "#myroom:example.com",
            content: newPollStart(undefined, undefined, true),
        });
        const props = getMPollBodyPropsFromEvent(mxEvent);
        const room = await setupRoomWithPollEvents([mxEvent], votes, [], mockClient);
        const renderResult = renderMPollBodyWithWrapper(props);
        // wait for /relations promise to resolve
        await flushPromises();

        clickOption(renderResult, "pizza");

        // When a new vote from someone else comes in
        await act(() => room.processPollEvents([responseEvent("@xx:example.com", "wings", 101)]));

        // Then my vote is still for pizza
        // NOTE: the new event does not affect the counts for other people -
        //       that is handled through the Relations, not by listening to
        //       these timeline events.
        expect(votesCount(renderResult, "pizza")).toBe("1 vote");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");

        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 2 votes");

        // And my vote is highlighted
        expect(voteButton(renderResult, "pizza").className.includes(CHECKED)).toBe(true);
        expect(voteButton(renderResult, "wings").className.includes(CHECKED)).toBe(false);
    });

    it("highlights my vote even if I did it on another device", async () => {
        // Given I voted italian
        const votes = [responseEvent("@me:example.com", "italian"), responseEvent("@nf:example.com", "wings")];
        const renderResult = await newMPollBody(votes);

        // But I didn't click anything locally

        // Then my vote is highlighted, and others are not
        expect(voteButton(renderResult, "italian").className.includes(CHECKED)).toBe(true);
        expect(voteButton(renderResult, "wings").className.includes(CHECKED)).toBe(false);
    });

    it("ignores extra answers", async () => {
        // When cb votes for 2 things, we consider the first only
        const votes = [responseEvent("@cb:example.com", ["pizza", "wings"]), responseEvent("@me:example.com", "wings")];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("1 vote");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("1 vote");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 2 votes");
    });

    it("allows un-voting by passing an empty vote", async () => {
        const votes = [
            responseEvent("@nc:example.com", "pizza", 12),
            responseEvent("@nc:example.com", [], 13),
            responseEvent("@me:example.com", "italian"),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("1 vote");
        expect(votesCount(renderResult, "wings")).toBe("0 votes");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 1 vote");
    });

    it("allows re-voting after un-voting", async () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@me:example.com", "italian"),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("2 votes");
        expect(votesCount(renderResult, "wings")).toBe("0 votes");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 2 votes");
    });

    it("treats any invalid answer as a spoiled ballot", async () => {
        // Note that uy's second vote has a valid first answer, but
        // the ballot is still spoiled because the second answer is
        // invalid, even though we would ignore it if we continued.
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
        ];
        const renderResult = await newMPollBody(votes);
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("0 votes");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("0 votes");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 0 votes");
    });

    it("allows re-voting after a spoiled ballot", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
            responseEvent("@uy:example.com", "poutine", 16),
        ];
        const renderResult = await newMPollBody(votes);
        expect(renderResult.container.querySelectorAll('input[type="radio"]')).toHaveLength(4);
        expect(votesCount(renderResult, "pizza")).toBe("0 votes");
        expect(votesCount(renderResult, "poutine")).toBe("1 vote");
        expect(votesCount(renderResult, "italian")).toBe("0 votes");
        expect(votesCount(renderResult, "wings")).toBe("0 votes");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Based on 1 vote");
    });

    it("renders nothing if poll has no answers", async () => {
        const answers: PollAnswer[] = [];
        const votes: MatrixEvent[] = [];
        const ends: MatrixEvent[] = [];
        const { container } = await newMPollBody(votes, ends, answers);
        expect(container.childElementCount).toEqual(0);
    });

    it("renders the first 20 answers if 21 were given", async () => {
        const answers = Array.from(Array(21).keys()).map((i) => {
            return { id: `id${i}`, [M_TEXT.name]: `Name ${i}` };
        });
        const votes: MatrixEvent[] = [];
        const ends: MatrixEvent[] = [];
        const { container } = await newMPollBody(votes, ends, answers);
        expect(container.querySelectorAll(".mx_PollOption").length).toBe(20);
    });

    it("hides scores if I voted but the poll is undisclosed", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const renderResult = await newMPollBody(votes, [], undefined, false);
        expect(votesCount(renderResult, "pizza")).toBe("");
        expect(votesCount(renderResult, "poutine")).toBe("");
        expect(votesCount(renderResult, "italian")).toBe("");
        expect(votesCount(renderResult, "wings")).toBe("");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Results will be visible when the poll is ended");
    });

    it("highlights my vote if the poll is undisclosed", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "poutine"),
            responseEvent("@bellc:example.com", "poutine"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const { container } = await newMPollBody(votes, [], undefined, false);

        // My vote is marked
        expect(container.querySelector('input[value="pizza"]')!).toBeChecked();

        // Sanity: other items are not checked
        expect(container.querySelector('input[value="poutine"]')!).not.toBeChecked();
    });

    it("shows scores if the poll is undisclosed but ended", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const ends = [newPollEndEvent("@me:example.com", 12)];
        const renderResult = await newMPollBody(votes, ends, undefined, false);
        expect(endedVotesCount(renderResult, "pizza")).toBe('<div class="mx_PollOption_winnerIcon"></div>3 votes');
        expect(endedVotesCount(renderResult, "poutine")).toBe("1 vote");
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe("1 vote");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 5 votes");
    });

    it("sends a vote event when I choose an option", async () => {
        const votes: MatrixEvent[] = [];
        const renderResult = await newMPollBody(votes);
        clickOption(renderResult, "wings");
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("wings"));
    });

    it("sends only one vote event when I click several times", async () => {
        const votes: MatrixEvent[] = [];
        const renderResult = await newMPollBody(votes);
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("wings"));
    });

    it("sends no vote event when I click what I already chose", async () => {
        const votes = [responseEvent("@me:example.com", "wings")];
        const renderResult = await newMPollBody(votes);
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        clickOption(renderResult, "wings");
        expect(mockClient.sendEvent).not.toHaveBeenCalled();
    });

    it("sends several events when I click different options", async () => {
        const votes: MatrixEvent[] = [];
        const renderResult = await newMPollBody(votes);
        clickOption(renderResult, "wings");
        clickOption(renderResult, "italian");
        clickOption(renderResult, "poutine");
        expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("wings"));
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("italian"));
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("poutine"));
    });

    it("sends no events when I click in an ended poll", async () => {
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const votes = [responseEvent("@uy:example.com", "wings", 15), responseEvent("@uy:example.com", "poutine", 15)];
        const renderResult = await newMPollBody(votes, ends);
        clickOption(renderResult, "wings");
        clickOption(renderResult, "italian");
        clickOption(renderResult, "poutine");
        expect(mockClient.sendEvent).not.toHaveBeenCalled();
    });

    it("finds the top answer among several votes", async () => {
        // 2 votes for poutine, 1 for pizza.  "me" made an invalid vote.
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
            responseEvent("@uy:example.com", "poutine", 16),
            responseEvent("@ab:example.com", "pizza", 17),
            responseEvent("@fa:example.com", "poutine", 18),
        ];

        expect(runFindTopAnswer(votes)).toEqual("Poutine");
    });

    it("finds all top answers when there is a draw", async () => {
        const votes = [
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@ab:example.com", "pizza", 17),
            responseEvent("@fa:example.com", "poutine", 18),
        ];
        expect(runFindTopAnswer(votes)).toEqual("Italian, Pizza and Poutine");
    });

    it("is silent about the top answer if there are no votes", async () => {
        expect(runFindTopAnswer([])).toEqual("");
    });

    it("shows non-radio buttons if the poll is ended", async () => {
        const events = [newPollEndEvent()];
        const { container } = await newMPollBody([], events);
        expect(container.querySelector(".mx_StyledRadioButton")).not.toBeInTheDocument();
        expect(container.querySelector('input[type="radio"]')).not.toBeInTheDocument();
    });

    it("counts votes as normal if the poll is ended", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "wings", 20), // latest me
            responseEvent("@qbert:example.com", "pizza", 14),
            responseEvent("@qbert:example.com", "poutine", 16), // latest qbert
            responseEvent("@qbert:example.com", "wings", 15),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);
        expect(endedVotesCount(renderResult, "pizza")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "poutine")).toBe('<div class="mx_PollOption_winnerIcon"></div>1 vote');
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe('<div class="mx_PollOption_winnerIcon"></div>1 vote');
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 2 votes");
    });

    it("counts a single vote as normal if the poll is ended", async () => {
        const votes = [responseEvent("@qbert:example.com", "poutine", 16)];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);
        expect(endedVotesCount(renderResult, "pizza")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "poutine")).toBe('<div class="mx_PollOption_winnerIcon"></div>1 vote');
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe("0 votes");
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 1 vote");
    });

    it("shows ended vote counts of different numbers", async () => {
        const votes = [
            responseEvent("@me:example.com", "wings", 20),
            responseEvent("@qb:example.com", "wings", 14),
            responseEvent("@xy:example.com", "wings", 15),
            responseEvent("@fg:example.com", "pizza", 15),
            responseEvent("@hi:example.com", "pizza", 15),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);

        expect(renderResult.container.querySelectorAll(".mx_StyledRadioButton")).toHaveLength(0);
        expect(renderResult.container.querySelectorAll('input[type="radio"]')).toHaveLength(0);
        expect(endedVotesCount(renderResult, "pizza")).toBe("2 votes");
        expect(endedVotesCount(renderResult, "poutine")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe('<div class="mx_PollOption_winnerIcon"></div>3 votes');
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 5 votes");
    });

    it("ignores votes that arrived after poll ended", async () => {
        const votes = [
            responseEvent("@sd:example.com", "wings", 30), // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 15),
            responseEvent("@jf:example.com", "wings", 35), // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);

        expect(endedVotesCount(renderResult, "pizza")).toBe("2 votes");
        expect(endedVotesCount(renderResult, "poutine")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe('<div class="mx_PollOption_winnerIcon"></div>3 votes');
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 5 votes");
    });

    it("counts votes that arrived after an unauthorised poll end event", async () => {
        const votes = [
            responseEvent("@sd:example.com", "wings", 30), // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 15),
            responseEvent("@jf:example.com", "wings", 35), // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [
            newPollEndEvent("@unauthorised:example.com", 5), // Should be ignored
            newPollEndEvent("@me:example.com", 25),
        ];
        const renderResult = await newMPollBody(votes, ends);

        await waitFor(() => {
            expect(endedVotesCount(renderResult, "pizza")).toBe("2 votes");
            expect(endedVotesCount(renderResult, "poutine")).toBe("0 votes");
            expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
            expect(endedVotesCount(renderResult, "wings")).toBe('<div class="mx_PollOption_winnerIcon"></div>3 votes');
            expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 5 votes");
        });
    });

    it("ignores votes that arrived after the first end poll event", async () => {
        // From MSC3381:
        // "Votes sent on or before the end event's timestamp are valid votes"

        const votes = [
            responseEvent("@sd:example.com", "wings", 30), // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 25), // Just on time
            responseEvent("@jf:example.com", "wings", 35), // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [
            newPollEndEvent("@me:example.com", 65),
            newPollEndEvent("@me:example.com", 25),
            newPollEndEvent("@me:example.com", 75),
        ];
        const renderResult = await newMPollBody(votes, ends);

        expect(endedVotesCount(renderResult, "pizza")).toBe("2 votes");
        expect(endedVotesCount(renderResult, "poutine")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "italian")).toBe("0 votes");
        expect(endedVotesCount(renderResult, "wings")).toBe('<div class="mx_PollOption_winnerIcon"></div>3 votes');
        expect(renderResult.getByTestId("totalVotes").innerHTML).toBe("Final result based on 5 votes");
    });

    it("highlights the winning vote in an ended poll", async () => {
        // Given I voted for pizza but the winner is wings
        const votes = [
            responseEvent("@me:example.com", "pizza", 20),
            responseEvent("@qb:example.com", "wings", 14),
            responseEvent("@xy:example.com", "wings", 15),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);

        // Then the winner is highlighted
        expect(endedVoteChecked(renderResult, "wings")).toBe(true);
        expect(endedVoteChecked(renderResult, "pizza")).toBe(false);

        // Double-check by looking for the endedOptionWinner class
        expect(endedVoteDiv(renderResult, "wings").className.includes("mx_PollOption_endedOptionWinner")).toBe(true);
        expect(endedVoteDiv(renderResult, "pizza").className.includes("mx_PollOption_endedOptionWinner")).toBe(false);
    });

    it("highlights multiple winning votes", async () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 20),
            responseEvent("@xy:example.com", "wings", 15),
            responseEvent("@fg:example.com", "poutine", 15),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody(votes, ends);

        expect(endedVoteChecked(renderResult, "pizza")).toBe(true);
        expect(endedVoteChecked(renderResult, "wings")).toBe(true);
        expect(endedVoteChecked(renderResult, "poutine")).toBe(true);
        expect(endedVoteChecked(renderResult, "italian")).toBe(false);
        expect(renderResult.container.getElementsByClassName(CHECKED)).toHaveLength(3);
    });

    it("highlights nothing if poll has no votes", async () => {
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const renderResult = await newMPollBody([], ends);
        expect(renderResult.container.getElementsByClassName(CHECKED)).toHaveLength(0);
    });

    it("says poll is not ended if there is no end event", async () => {
        const ends: MatrixEvent[] = [];
        const result = await runIsPollEnded(ends);
        expect(result).toBe(false);
    });

    it("says poll is ended if there is an end event", async () => {
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const result = await runIsPollEnded(ends);
        expect(result).toBe(true);
    });

    it("says poll is not ended if poll is fetching responses", async () => {
        const pollEvent = new MatrixEvent({
            type: M_POLL_START.name,
            event_id: "$mypoll",
            room_id: "#myroom:example.com",
            content: newPollStart([]),
        });
        const ends = [newPollEndEvent("@me:example.com", 25)];

        await setupRoomWithPollEvents([pollEvent], [], ends, mockClient);
        const poll = mockClient.getRoom(pollEvent.getRoomId()!)!.polls.get(pollEvent.getId()!)!;
        // start fetching, dont await
        poll.getResponses();
        expect(isPollEnded(pollEvent, mockClient)).toBe(false);
    });

    it("Displays edited content and new answer IDs if the poll has been edited", async () => {
        const pollEvent = new MatrixEvent({
            type: M_POLL_START.name,
            event_id: "$mypoll",
            room_id: "#myroom:example.com",
            content: newPollStart(
                [
                    { id: "o1", [M_TEXT.name]: "old answer 1" },
                    { id: "o2", [M_TEXT.name]: "old answer 2" },
                ],
                "old question",
            ),
        });
        const replacingEvent = new MatrixEvent({
            type: M_POLL_START.name,
            event_id: "$mypollreplacement",
            room_id: "#myroom:example.com",
            content: {
                "m.new_content": newPollStart(
                    [
                        { id: "n1", [M_TEXT.name]: "new answer 1" },
                        { id: "n2", [M_TEXT.name]: "new answer 2" },
                        { id: "n3", [M_TEXT.name]: "new answer 3" },
                    ],
                    "new question",
                ),
            },
        });
        pollEvent.makeReplaced(replacingEvent);
        const { getByTestId, container } = await newMPollBodyFromEvent(pollEvent, []);
        expect(getByTestId("pollQuestion").innerHTML).toEqual(
            'new question<span class="mx_MPollBody_edited"> (edited)</span>',
        );
        const inputs = container.querySelectorAll('input[type="radio"]');
        expect(inputs).toHaveLength(3);
        expect(inputs[0].getAttribute("value")).toEqual("n1");
        expect(inputs[1].getAttribute("value")).toEqual("n2");
        expect(inputs[2].getAttribute("value")).toEqual("n3");
        const options = container.querySelectorAll(".mx_PollOption_optionText");
        expect(options).toHaveLength(3);
        expect(options[0].innerHTML).toEqual("new answer 1");
        expect(options[1].innerHTML).toEqual("new answer 2");
        expect(options[2].innerHTML).toEqual("new answer 3");
    });

    it("renders a poll with no votes", async () => {
        const votes: MatrixEvent[] = [];
        const { container } = await newMPollBody(votes);
        expect(container).toMatchSnapshot();
    });

    it("renders a poll with only non-local votes", async () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@me:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const { container } = await newMPollBody(votes);
        expect(container).toMatchSnapshot();
    });

    it("renders a warning message when poll has undecryptable relations", async () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@me:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];

        jest.spyOn(votes[1], "isDecryptionFailure").mockReturnValue(true);
        const { getByText } = await newMPollBody(votes);
        expect(getByText("Due to decryption errors, some votes may not be counted")).toBeInTheDocument();
    });

    it("renders a poll with local, non-local and invalid votes", async () => {
        const votes = [
            responseEvent("@a:example.com", "pizza", 12),
            responseEvent("@b:example.com", [], 13),
            responseEvent("@c:example.com", "italian", 14),
            responseEvent("@d:example.com", "italian", 14),
            responseEvent("@e:example.com", "wings", 15),
            responseEvent("@me:example.com", "italian", 16),
        ];
        const renderResult = await newMPollBody(votes);
        clickOption(renderResult, "italian");

        expect(renderResult.container).toMatchSnapshot();
    });

    it("renders a poll that I have not voted in", async () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@yo:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const { container } = await newMPollBody(votes);
        expect(container).toMatchSnapshot();
    });

    it("renders a finished poll with no votes", async () => {
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const { container } = await newMPollBody([], ends);
        expect(container).toMatchSnapshot();
    });

    it("renders a finished poll", async () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@yo:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const { container } = await newMPollBody(votes, ends);
        expect(container).toMatchSnapshot();
    });

    it("renders a finished poll with multiple winners", async () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const { container } = await newMPollBody(votes, ends);
        expect(container).toMatchSnapshot();
    });

    it("renders an undisclosed, unfinished poll", async () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends: MatrixEvent[] = [];
        const { container } = await newMPollBody(votes, ends, undefined, false);
        expect(container).toMatchSnapshot();
    });

    it("renders an undisclosed, finished poll", async () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends = [newPollEndEvent("@me:example.com", 25)];
        const { container } = await newMPollBody(votes, ends, undefined, false);
        expect(container).toMatchSnapshot();
    });
});

function newVoteRelations(relationEvents: Array<MatrixEvent>): Relations {
    return newRelations(relationEvents, M_POLL_RESPONSE.name, [M_POLL_RESPONSE.altName!]);
}

function newRelations(relationEvents: Array<MatrixEvent>, eventType: string, altEventTypes?: string[]): Relations {
    const voteRelations = new Relations("m.reference", eventType, mockClient, altEventTypes);
    for (const ev of relationEvents) {
        voteRelations.addEvent(ev);
    }
    return voteRelations;
}

async function newMPollBody(
    relationEvents: Array<MatrixEvent>,
    endEvents: Array<MatrixEvent> = [],
    answers?: PollAnswer[],
    disclosed = true,
    waitForResponsesLoad = true,
): Promise<RenderResult> {
    const mxEvent = new MatrixEvent({
        type: M_POLL_START.name,
        event_id: "$mypoll",
        room_id: "#myroom:example.com",
        content: newPollStart(answers, undefined, disclosed),
    });
    const prom = newMPollBodyFromEvent(mxEvent, relationEvents, endEvents);
    if (waitForResponsesLoad) {
        const result = await prom;
        if (result.queryByTestId("spinner")) {
            await waitForElementToBeRemoved(() => result.getByTestId("spinner"));
        }
    }
    return prom;
}

function getMPollBodyPropsFromEvent(mxEvent: MatrixEvent): IBodyProps {
    return {
        mxEvent,
        // We don't use any of these props, but they're required.
        highlightLink: "unused",
        highlights: [],
        mediaEventHelper: {} as unknown as MediaEventHelper,
        onMessageAllowed: () => {},
        permalinkCreator: {} as unknown as RoomPermalinkCreator,
    };
}

function renderMPollBodyWithWrapper(props: IBodyProps): RenderResult {
    return render(<MPollBody {...props} />, {
        wrapper: ({ children }) => (
            <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
        ),
    });
}

async function newMPollBodyFromEvent(
    mxEvent: MatrixEvent,
    relationEvents: Array<MatrixEvent>,
    endEvents: Array<MatrixEvent> = [],
): Promise<RenderResult> {
    const props = getMPollBodyPropsFromEvent(mxEvent);

    await setupRoomWithPollEvents([mxEvent], relationEvents, endEvents, mockClient);

    return renderMPollBodyWithWrapper(props);
}

function clickOption({ getByTestId }: RenderResult, value: string) {
    fireEvent.click(getByTestId(`pollOption-${value}`));
}

function voteButton({ getByTestId }: RenderResult, value: string): Element {
    return getByTestId(`pollOption-${value}`);
}

function votesCount({ getByTestId }: RenderResult, value: string): string {
    return getByTestId(`pollOption-${value}`).querySelector(".mx_PollOption_optionVoteCount")!.innerHTML;
}

function endedVoteChecked({ getByTestId }: RenderResult, value: string): boolean {
    return getByTestId(`pollOption-${value}`).className.includes(CHECKED);
}

function endedVoteDiv({ getByTestId }: RenderResult, value: string): Element {
    return getByTestId(`pollOption-${value}`).firstElementChild!;
}

function endedVotesCount(renderResult: RenderResult, value: string): string {
    return votesCount(renderResult, value);
}

function newPollStart(answers?: PollAnswer[], question?: string, disclosed = true): PollStartEventContent {
    if (!answers) {
        answers = [
            { id: "pizza", [M_TEXT.name]: "Pizza" },
            { id: "poutine", [M_TEXT.name]: "Poutine" },
            { id: "italian", [M_TEXT.name]: "Italian" },
            { id: "wings", [M_TEXT.name]: "Wings" },
        ];
    }

    if (!question) {
        question = "What should we order for the party?";
    }

    const answersFallback = answers.map((a, i) => `${i + 1}. ${M_TEXT.findIn<string>(a)}`).join("\n");

    const fallback = `${question}\n${answersFallback}`;

    return {
        [M_POLL_START.name]: {
            question: {
                [M_TEXT.name]: question,
            },
            kind: disclosed ? M_POLL_KIND_DISCLOSED.name : M_POLL_KIND_UNDISCLOSED.name,
            answers: answers,
        },
        [M_TEXT.name]: fallback,
    };
}

function responseEvent(
    sender = "@alice:example.com",
    answers: string | Array<string> = "italian",
    ts = 0,
): MatrixEvent {
    const ans = typeof answers === "string" ? [answers] : answers;
    return new MatrixEvent({
        event_id: nextId(),
        room_id: "#myroom:example.com",
        origin_server_ts: ts,
        type: M_POLL_RESPONSE.name,
        sender: sender,
        content: {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: "$mypoll",
            },
            [M_POLL_RESPONSE.name]: {
                answers: ans,
            },
        },
    });
}

function expectedResponseEvent(answer: string) {
    return {
        content: {
            [M_POLL_RESPONSE.name]: {
                answers: [answer],
            },
            "m.relates_to": {
                event_id: "$mypoll",
                rel_type: "m.reference",
            },
        },
        roomId: "#myroom:example.com",
        eventType: M_POLL_RESPONSE.name,
        txnId: "$123",
    };
}
function expectedResponseEventCall(answer: string) {
    const { content, roomId, eventType } = expectedResponseEvent(answer);
    return [roomId, eventType, content];
}

function newPollEndEvent(sender = "@me:example.com", ts = 0): MatrixEvent {
    return makePollEndEvent("$mypoll", "#myroom:example.com", sender, ts);
}

async function runIsPollEnded(ends: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        event_id: "$mypoll",
        room_id: "#myroom:example.com",
        type: M_POLL_START.name,
        content: newPollStart(),
    });

    await setupRoomWithPollEvents([pollEvent], [], ends, mockClient);

    return isPollEnded(pollEvent, mockClient);
}

function runFindTopAnswer(votes: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        event_id: "$mypoll",
        room_id: "#myroom:example.com",
        type: M_POLL_START.name,
        content: newPollStart(),
    });

    return findTopAnswer(pollEvent, newVoteRelations(votes));
}

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
