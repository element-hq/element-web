/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { RelatedRelations } from "matrix-js-sdk/src/models/related-relations";
import {
    M_POLL_END,
    M_POLL_KIND_DISCLOSED,
    M_POLL_KIND_UNDISCLOSED,
    M_POLL_RESPONSE,
    M_POLL_START,
    M_POLL_START_EVENT_CONTENT,
    M_TEXT,
    POLL_ANSWER,
} from "matrix-events-sdk";
import { MockedObject } from "jest-mock";

import {
    UserVote,
    allVotes,
    findTopAnswer,
    pollEndTs,
    isPollEnded,
} from "../../../../src/components/views/messages/MPollBody";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { IBodyProps } from "../../../../src/components/views/messages/IBodyProps";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import MPollBody from "../../../../src/components/views/messages/MPollBody";

const CHECKED = "mx_MPollBody_option_checked";

const mockClient = getMockClientWithEventEmitter({
    getUserId: jest.fn().mockReturnValue("@me:example.com"),
    sendEvent: jest.fn().mockReturnValue(Promise.resolve({ "event_id": "fake_send_id" })),
    getRoom: jest.fn(),
});

setRedactionAllowedForMeOnly(mockClient);

describe("MPollBody", () => {
    beforeEach(() => {
        mockClient.sendEvent.mockClear();
    });

    it("finds no votes if there are none", () => {
        expect(
            allVotes(
                { getRoomId: () => "$room" } as MatrixEvent,
                MatrixClientPeg.get(),
                new RelatedRelations([newVoteRelations([])]),
                new RelatedRelations([newEndRelations([])]),
            ),
        ).toEqual([]);
    });

    it("can find all the valid responses to a poll", () => {
        const ev1 = responseEvent();
        const ev2 = responseEvent();
        const badEvent = badResponseEvent();

        const voteRelations = new RelatedRelations([
            newVoteRelations([ev1, badEvent, ev2]),
        ]);
        expect(
            allVotes(
                { getRoomId: () => "$room" } as MatrixEvent,
                MatrixClientPeg.get(),
                voteRelations,
                new RelatedRelations([newEndRelations([])]),
            ),
        ).toEqual([
            new UserVote(
                ev1.getTs(),
                ev1.getSender(),
                ev1.getContent()[M_POLL_RESPONSE.name].answers,
            ),
            new UserVote(
                badEvent.getTs(),
                badEvent.getSender(),
                [], // should be spoiled
            ),
            new UserVote(
                ev2.getTs(),
                ev2.getSender(),
                ev2.getContent()[M_POLL_RESPONSE.name].answers,
            ),
        ]);
    });

    it("finds the first end poll event", () => {
        const endRelations = new RelatedRelations([
            newEndRelations([
                endEvent("@me:example.com", 25),
                endEvent("@me:example.com", 12),
                endEvent("@me:example.com", 45),
                endEvent("@me:example.com", 13),
            ]),
        ]);

        setRedactionAllowedForMeOnly(mockClient);

        expect(
            pollEndTs(
                { getRoomId: () => "$room" } as MatrixEvent,
                mockClient,
                endRelations,
            ),
        ).toBe(12);
    });

    it("ignores unauthorised end poll event when finding end ts", () => {
        const endRelations = new RelatedRelations([
            newEndRelations([
                endEvent("@me:example.com", 25),
                endEvent("@unauthorised:example.com", 12),
                endEvent("@me:example.com", 45),
                endEvent("@me:example.com", 13),
            ]),
        ]);

        setRedactionAllowedForMeOnly(mockClient);

        expect(
            pollEndTs(
                { getRoomId: () => "$room" } as MatrixEvent,
                mockClient,
                endRelations,
            ),
        ).toBe(13);
    });

    it("counts only votes before the end poll event", () => {
        const voteRelations = new RelatedRelations([
            newVoteRelations([
                responseEvent("sf@matrix.org", "wings", 13),
                responseEvent("jr@matrix.org", "poutine", 40),
                responseEvent("ak@matrix.org", "poutine", 37),
                responseEvent("id@matrix.org", "wings", 13),
                responseEvent("ps@matrix.org", "wings", 19),
            ]),
        ]);
        const endRelations = new RelatedRelations([
            newEndRelations([
                endEvent("@me:example.com", 25),
            ]),
        ]);
        expect(
            allVotes(
                { getRoomId: () => "$room" } as MatrixEvent,
                MatrixClientPeg.get(),
                voteRelations,
                endRelations,
            ),
        ).toEqual([
            new UserVote(13, "sf@matrix.org", ["wings"]),
            new UserVote(13, "id@matrix.org", ["wings"]),
            new UserVote(19, "ps@matrix.org", ["wings"]),
        ]);
    });

    it("renders no votes if none were made", () => {
        const votes = [];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("");
        expect(votesCount(body, "poutine")).toBe("");
        expect(votesCount(body, "italian")).toBe("");
        expect(votesCount(body, "wings")).toBe("");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("No votes cast");
        expect(body.find('h2').html())
            .toEqual("<h2>What should we order for the party?</h2>");
    });

    it("finds votes from multiple people", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("2 votes");
        expect(votesCount(body, "poutine")).toBe("1 vote");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 4 votes");
    });

    it("ignores end poll events from unauthorised users", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const ends = [
            endEvent("@notallowed:example.com", 12),
        ];
        const body = newMPollBody(votes, ends);

        // Even though an end event was sent, we render the poll as unfinished
        // because this person is not allowed to send these events
        expect(votesCount(body, "pizza")).toBe("2 votes");
        expect(votesCount(body, "poutine")).toBe("1 vote");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 4 votes");
    });

    it("hides scores if I have not voted", () => {
        const votes = [
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("");
        expect(votesCount(body, "poutine")).toBe("");
        expect(votesCount(body, "italian")).toBe("");
        expect(votesCount(body, "wings")).toBe("");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe(
            "4 votes cast. Vote to see the results");
    });

    it("hides a single vote if I have not voted", () => {
        const votes = [
            responseEvent("@alice:example.com", "pizza"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("");
        expect(votesCount(body, "poutine")).toBe("");
        expect(votesCount(body, "italian")).toBe("");
        expect(votesCount(body, "wings")).toBe("");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe(
            "1 vote cast. Vote to see the results");
    });

    it("takes someone's most recent vote if they voted several times", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "wings", 20),   // latest me
            responseEvent("@qbert:example.com", "pizza", 14),
            responseEvent("@qbert:example.com", "poutine", 16), // latest qbert
            responseEvent("@qbert:example.com", "wings", 15),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("1 vote");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 2 votes");
    });

    it("uses my local vote", () => {
        // Given I haven't voted
        const votes = [
            responseEvent("@nf:example.com", "pizza", 15),
            responseEvent("@fg:example.com", "pizza", 15),
            responseEvent("@hi:example.com", "pizza", 15),
        ];
        const body = newMPollBody(votes);

        // When I vote for Italian
        clickRadio(body, "italian");

        // My vote is counted
        expect(votesCount(body, "pizza")).toBe("3 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("1 vote");
        expect(votesCount(body, "wings")).toBe("0 votes");

        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 4 votes");
    });

    it("overrides my other votes with my local vote", () => {
        // Given two of us have voted for Italian
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "poutine", 13),
            responseEvent("@me:example.com", "italian", 14),
            responseEvent("@nf:example.com", "italian", 15),
        ];
        const body = newMPollBody(votes);

        // When I click Wings
        clickRadio(body, "wings");

        // Then my vote is counted for Wings, and not for Italian
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("1 vote");
        expect(votesCount(body, "wings")).toBe("1 vote");

        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 2 votes");

        // And my vote is highlighted
        expect(voteButton(body, "wings").hasClass(CHECKED)).toBe(true);
        expect(voteButton(body, "italian").hasClass(CHECKED)).toBe(false);
    });

    it("cancels my local vote if another comes in", () => {
        // Given I voted locally
        const votes = [responseEvent("@me:example.com", "pizza", 100)];
        const body = newMPollBody(votes);
        const props: IBodyProps = body.instance().props as IBodyProps;
        const voteRelations: Relations = props.getRelationsForEvent(
            "$mypoll", "m.reference", M_POLL_RESPONSE.name);
        clickRadio(body, "pizza");

        // When a new vote from me comes in
        voteRelations.addEvent(responseEvent("@me:example.com", "wings", 101));

        // Then the new vote is counted, not the old one
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");

        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 1 vote");
    });

    it("doesn't cancel my local vote if someone else votes", () => {
        // Given I voted locally
        const votes = [responseEvent("@me:example.com", "pizza")];
        const body = newMPollBody(votes);
        const props: IBodyProps = body.instance().props as IBodyProps;
        const voteRelations: Relations = props.getRelationsForEvent(
            "$mypoll", "m.reference", M_POLL_RESPONSE.name);
        clickRadio(body, "pizza");

        // When a new vote from someone else comes in
        voteRelations.addEvent(responseEvent("@xx:example.com", "wings", 101));

        // Then my vote is still for pizza
        // NOTE: the new event does not affect the counts for other people -
        //       that is handled through the Relations, not by listening to
        //       these timeline events.
        expect(votesCount(body, "pizza")).toBe("1 vote");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");

        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 2 votes");

        // And my vote is highlighted
        expect(voteButton(body, "pizza").hasClass(CHECKED)).toBe(true);
        expect(voteButton(body, "wings").hasClass(CHECKED)).toBe(false);
    });

    it("highlights my vote even if I did it on another device", () => {
        // Given I voted italian
        const votes = [
            responseEvent("@me:example.com", "italian"),
            responseEvent("@nf:example.com", "wings"),
        ];
        const body = newMPollBody(votes);

        // But I didn't click anything locally

        // Then my vote is highlighted, and others are not
        expect(voteButton(body, "italian").hasClass(CHECKED)).toBe(true);
        expect(voteButton(body, "wings").hasClass(CHECKED)).toBe(false);
    });

    it("ignores extra answers", () => {
        // When cb votes for 2 things, we consider the first only
        const votes = [
            responseEvent("@cb:example.com", ["pizza", "wings"]),
            responseEvent("@me:example.com", "wings"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("1 vote");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("1 vote");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 2 votes");
    });

    it("allows un-voting by passing an empty vote", () => {
        const votes = [
            responseEvent("@nc:example.com", "pizza", 12),
            responseEvent("@nc:example.com", [], 13),
            responseEvent("@me:example.com", "italian"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("1 vote");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 1 vote");
    });

    it("allows re-voting after un-voting", () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@me:example.com", "italian"),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("2 votes");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 2 votes");
    });

    it("treats any invalid answer as a spoiled ballot", () => {
        // Note that uy's second vote has a valid first answer, but
        // the ballot is still spoiled because the second answer is
        // invalid, even though we would ignore it if we continued.
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 0 votes");
    });

    it("allows re-voting after a spoiled ballot", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
            responseEvent("@uy:example.com", "poutine", 16),
        ];
        const body = newMPollBody(votes);
        expect(body.find('input[type="radio"]')).toHaveLength(4);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("1 vote");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 1 vote");
    });

    it("renders nothing if poll has no answers", () => {
        const answers = [];
        const votes = [];
        const ends = [];
        const body = newMPollBody(votes, ends, answers);
        expect(body.html()).toBeNull();
    });

    it("renders the first 20 answers if 21 were given", () => {
        const answers = Array.from(Array(21).keys()).map((i) => {
            return { "id": `id${i}`, [M_TEXT.name]: `Name ${i}` };
        });
        const votes = [];
        const ends = [];
        const body = newMPollBody(votes, ends, answers);
        expect(
            body.find('.mx_MPollBody_option').length,
        ).toBe(20);
    });

    it("hides scores if I voted but the poll is undisclosed", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const body = newMPollBody(votes, [], null, false);
        expect(votesCount(body, "pizza")).toBe("");
        expect(votesCount(body, "poutine")).toBe("");
        expect(votesCount(body, "italian")).toBe("");
        expect(votesCount(body, "wings")).toBe("");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe(
            "Results will be visible when the poll is ended");
    });

    it("highlights my vote if the poll is undisclosed", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "poutine"),
            responseEvent("@bellc:example.com", "poutine"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const body = newMPollBody(votes, [], null, false);

        // My vote is marked
        expect(body.find('input[value="pizza"]').prop("checked")).toBeTruthy();

        // Sanity: other items are not checked
        expect(body.find('input[value="poutine"]').prop("checked")).toBeFalsy();
    });

    it("shows scores if the poll is undisclosed but ended", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza"),
            responseEvent("@alice:example.com", "pizza"),
            responseEvent("@bellc:example.com", "pizza"),
            responseEvent("@catrd:example.com", "poutine"),
            responseEvent("@dune2:example.com", "wings"),
        ];
        const ends = [
            endEvent("@me:example.com", 12),
        ];
        const body = newMPollBody(votes, ends, null, false);
        expect(endedVotesCount(body, "pizza")).toBe("3 votes");
        expect(endedVotesCount(body, "poutine")).toBe("1 vote");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("1 vote");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe(
            "Final result based on 5 votes");
    });

    it("sends a vote event when I choose an option", () => {
        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("wings"));
    });

    it("sends only one vote event when I click several times", () => {
        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        expect(mockClient.sendEvent).toHaveBeenCalledWith(
            ...expectedResponseEventCall("wings"),
        );
    });

    it("sends no vote event when I click what I already chose", () => {
        const votes = [responseEvent("@me:example.com", "wings")];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        expect(mockClient.sendEvent).not.toHaveBeenCalled();
    });

    it("sends several events when I click different options", () => {
        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "italian");
        clickRadio(body, "poutine");
        expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("wings"));
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("italian"));
        expect(mockClient.sendEvent).toHaveBeenCalledWith(...expectedResponseEventCall("poutine"));
    });

    it("sends no events when I click in an ended poll", () => {
        const ends = [
            endEvent("@me:example.com", 25),
        ];
        const votes = [
            responseEvent("@uy:example.com", "wings", 15),
            responseEvent("@uy:example.com", "poutine", 15),
        ];
        const body = newMPollBody(votes, ends);
        clickEndedOption(body, "wings");
        clickEndedOption(body, "italian");
        clickEndedOption(body, "poutine");
        expect(mockClient.sendEvent).not.toHaveBeenCalled();
    });

    it("finds the top answer among several votes", () => {
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

        expect(runFindTopAnswer(votes, [])).toEqual("Poutine");
    });

    it("finds all top answers when there is a draw", () => {
        const votes = [
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@ab:example.com", "pizza", 17),
            responseEvent("@fa:example.com", "poutine", 18),
        ];
        expect(runFindTopAnswer(votes, [])).toEqual("Italian, Pizza and Poutine");
    });

    it("finds all top answers ignoring late votes", () => {
        const votes = [
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@ab:example.com", "pizza", 17),
            responseEvent("@io:example.com", "poutine", 30), // Late
            responseEvent("@fa:example.com", "poutine", 18),
            responseEvent("@of:example.com", "poutine", 31), // Late
        ];
        const ends = [
            endEvent("@me:example.com", 25),
        ];
        expect(runFindTopAnswer(votes, ends)).toEqual("Italian, Pizza and Poutine");
    });

    it("is silent about the top answer if there are no votes", () => {
        expect(runFindTopAnswer([], [])).toEqual("");
    });

    it("is silent about the top answer if there are no votes when ended", () => {
        expect(runFindTopAnswer([], [endEvent("@me:example.com", 13)])).toEqual("");
    });

    it("shows non-radio buttons if the poll is ended", () => {
        const events = [endEvent()];
        const body = newMPollBody([], events);
        expect(body.find(".mx_StyledRadioButton")).toHaveLength(0);
        expect(body.find('input[type="radio"]')).toHaveLength(0);
    });

    it("counts votes as normal if the poll is ended", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 12),
            responseEvent("@me:example.com", "wings", 20),   // latest me
            responseEvent("@qbert:example.com", "pizza", 14),
            responseEvent("@qbert:example.com", "poutine", 16), // latest qbert
            responseEvent("@qbert:example.com", "wings", 15),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);
        expect(endedVotesCount(body, "pizza")).toBe("0 votes");
        expect(endedVotesCount(body, "poutine")).toBe("1 vote");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("1 vote");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 2 votes");
    });

    it("counts a single vote as normal if the poll is ended", () => {
        const votes = [responseEvent("@qbert:example.com", "poutine", 16)];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);
        expect(endedVotesCount(body, "pizza")).toBe("0 votes");
        expect(endedVotesCount(body, "poutine")).toBe("1 vote");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("0 votes");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 1 vote");
    });

    it("shows ended vote counts of different numbers", () => {
        const votes = [
            responseEvent("@me:example.com", "wings", 20),
            responseEvent("@qb:example.com", "wings", 14),
            responseEvent("@xy:example.com", "wings", 15),
            responseEvent("@fg:example.com", "pizza", 15),
            responseEvent("@hi:example.com", "pizza", 15),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);

        expect(body.find(".mx_StyledRadioButton")).toHaveLength(0);
        expect(body.find('input[type="radio"]')).toHaveLength(0);
        expect(endedVotesCount(body, "pizza")).toBe("2 votes");
        expect(endedVotesCount(body, "poutine")).toBe("0 votes");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("3 votes");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 5 votes");
    });

    it("ignores votes that arrived after poll ended", () => {
        const votes = [
            responseEvent("@sd:example.com", "wings", 30),  // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 15),
            responseEvent("@jf:example.com", "wings", 35),  // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);

        expect(endedVotesCount(body, "pizza")).toBe("2 votes");
        expect(endedVotesCount(body, "poutine")).toBe("0 votes");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("3 votes");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 5 votes");
    });

    it("counts votes that arrived after an unauthorised poll end event", () => {
        const votes = [
            responseEvent("@sd:example.com", "wings", 30),  // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 15),
            responseEvent("@jf:example.com", "wings", 35),  // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [
            endEvent("@unauthorised:example.com", 5),  // Should be ignored
            endEvent("@me:example.com", 25),
        ];
        const body = newMPollBody(votes, ends);

        expect(endedVotesCount(body, "pizza")).toBe("2 votes");
        expect(endedVotesCount(body, "poutine")).toBe("0 votes");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("3 votes");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 5 votes");
    });

    it("ignores votes that arrived after the first end poll event", () => {
        // From MSC3381:
        // "Votes sent on or before the end event's timestamp are valid votes"

        const votes = [
            responseEvent("@sd:example.com", "wings", 30),  // Late
            responseEvent("@ff:example.com", "wings", 20),
            responseEvent("@ut:example.com", "wings", 14),
            responseEvent("@iu:example.com", "wings", 25),  // Just on time
            responseEvent("@jf:example.com", "wings", 35),  // Late
            responseEvent("@wf:example.com", "pizza", 15),
            responseEvent("@ld:example.com", "pizza", 15),
        ];
        const ends = [
            endEvent("@me:example.com", 65),
            endEvent("@me:example.com", 25),
            endEvent("@me:example.com", 75),
        ];
        const body = newMPollBody(votes, ends);

        expect(endedVotesCount(body, "pizza")).toBe("2 votes");
        expect(endedVotesCount(body, "poutine")).toBe("0 votes");
        expect(endedVotesCount(body, "italian")).toBe("0 votes");
        expect(endedVotesCount(body, "wings")).toBe("3 votes");
        expect(
            body.find(".mx_MPollBody_totalVotes").text(),
        ).toBe("Final result based on 5 votes");
    });

    it("highlights the winning vote in an ended poll", () => {
        // Given I voted for pizza but the winner is wings
        const votes = [
            responseEvent("@me:example.com", "pizza", 20),
            responseEvent("@qb:example.com", "wings", 14),
            responseEvent("@xy:example.com", "wings", 15),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);

        // Then the winner is highlighted
        expect(endedVoteChecked(body, "wings")).toBe(true);
        expect(endedVoteChecked(body, "pizza")).toBe(false);

        // Double-check by looking for the endedOptionWinner class
        expect(
            endedVoteDiv(body, "wings").hasClass("mx_MPollBody_endedOptionWinner"),
        ).toBe(true);
        expect(
            endedVoteDiv(body, "pizza").hasClass("mx_MPollBody_endedOptionWinner"),
        ).toBe(false);
    });

    it("highlights multiple winning votes", () => {
        const votes = [
            responseEvent("@me:example.com", "pizza", 20),
            responseEvent("@xy:example.com", "wings", 15),
            responseEvent("@fg:example.com", "poutine", 15),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);

        expect(endedVoteChecked(body, "pizza")).toBe(true);
        expect(endedVoteChecked(body, "wings")).toBe(true);
        expect(endedVoteChecked(body, "poutine")).toBe(true);
        expect(endedVoteChecked(body, "italian")).toBe(false);
        expect(body.find(".mx_MPollBody_option_checked")).toHaveLength(3);
    });

    it("highlights nothing if poll has no votes", () => {
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody([], ends);
        expect(body.find(".mx_MPollBody_option_checked")).toHaveLength(0);
    });

    it("says poll is not ended if there is no end event", () => {
        const ends = [];
        expect(runIsPollEnded(ends)).toBe(false);
    });

    it("says poll is ended if there is an end event", () => {
        const ends = [endEvent("@me:example.com", 25)];
        expect(runIsPollEnded(ends)).toBe(true);
    });

    it("says poll is not ended if endRelations is undefined", () => {
        const pollEvent = new MatrixEvent();
        setRedactionAllowedForMeOnly(mockClient);
        expect(isPollEnded(pollEvent, mockClient, undefined)).toBe(false);
    });

    it("says poll is not ended if asking for relations returns undefined", () => {
        const pollEvent = new MatrixEvent({
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "content": newPollStart([]),
        });
        mockClient.getRoom.mockImplementation((_roomId) => {
            return {
                currentState: {
                    maySendRedactionForEvent: (_evt: MatrixEvent, userId: string) => {
                        return userId === "@me:example.com";
                    },
                },
            } as unknown as Room;
        });
        const getRelationsForEvent =
            (eventId: string, relationType: string, eventType: string) => {
                expect(eventId).toBe("$mypoll");
                expect(relationType).toBe("m.reference");
                expect(M_POLL_END.matches(eventType)).toBe(true);
                return undefined;
            };
        expect(
            isPollEnded(
                pollEvent,
                MatrixClientPeg.get(),
                getRelationsForEvent,
            ),
        ).toBe(false);
    });

    it("Displays edited content and new answer IDs if the poll has been edited", () => {
        const pollEvent = new MatrixEvent({
            "type": M_POLL_START.name,
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "content": newPollStart(
                [
                    { "id": "o1", [M_TEXT.name]: "old answer 1" },
                    { "id": "o2", [M_TEXT.name]: "old answer 2" },
                ],
                "old question",
            ),
        });
        const replacingEvent = new MatrixEvent({
            "type": M_POLL_START.name,
            "event_id": "$mypollreplacement",
            "room_id": "#myroom:example.com",
            "content": {
                "m.new_content": newPollStart(
                    [
                        { "id": "n1", [M_TEXT.name]: "new answer 1" },
                        { "id": "n2", [M_TEXT.name]: "new answer 2" },
                        { "id": "n3", [M_TEXT.name]: "new answer 3" },
                    ],
                    "new question",
                ),
            },
        });
        pollEvent.makeReplaced(replacingEvent);
        const body = newMPollBodyFromEvent(pollEvent, []);
        expect(body.find('h2').html())
            .toEqual(
                "<h2>new question"
                + "<span class=\"mx_MPollBody_edited\"> (edited)</span>"
                + "</h2>",
            );
        const inputs = body.find('input[type="radio"]');
        expect(inputs).toHaveLength(3);
        expect(inputs.at(0).prop("value")).toEqual("n1");
        expect(inputs.at(1).prop("value")).toEqual("n2");
        expect(inputs.at(2).prop("value")).toEqual("n3");
        const options = body.find('.mx_MPollBody_optionText');
        expect(options).toHaveLength(3);
        expect(options.at(0).text()).toEqual("new answer 1");
        expect(options.at(1).text()).toEqual("new answer 2");
        expect(options.at(2).text()).toEqual("new answer 3");
    });

    it("renders a poll with no votes", () => {
        const votes = [];
        const body = newMPollBody(votes);
        expect(body).toMatchSnapshot();
    });

    it("renders a poll with only non-local votes", () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@me:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const body = newMPollBody(votes);
        expect(body).toMatchSnapshot();
    });

    it("renders a poll with local, non-local and invalid votes", () => {
        const votes = [
            responseEvent("@a:example.com", "pizza", 12),
            responseEvent("@b:example.com", [], 13),
            responseEvent("@c:example.com", "italian", 14),
            responseEvent("@d:example.com", "italian", 14),
            responseEvent("@e:example.com", "wings", 15),
            responseEvent("@me:example.com", "italian", 16),
        ];
        const body = newMPollBody(votes);
        clickRadio(body, "italian");
        expect(body).toMatchSnapshot();
    });

    it("renders a poll that I have not voted in", () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@yo:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const body = newMPollBody(votes);
        expect(body).toMatchSnapshot();
    });

    it("renders a finished poll with no votes", () => {
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody([], ends);
        expect(body).toMatchSnapshot();
    });

    it("renders a finished poll", () => {
        const votes = [
            responseEvent("@op:example.com", "pizza", 12),
            responseEvent("@op:example.com", [], 13),
            responseEvent("@op:example.com", "italian", 14),
            responseEvent("@yo:example.com", "wings", 15),
            responseEvent("@qr:example.com", "italian", 16),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);
        expect(body).toMatchSnapshot();
    });

    it("renders a finished poll with multiple winners", () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends);
        expect(body).toMatchSnapshot();
    });

    it("renders an undisclosed, unfinished poll", () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends = [];
        const body = newMPollBody(votes, ends, null, false);
        expect(body.html()).toMatchSnapshot();
    });

    it("renders an undisclosed, finished poll", () => {
        const votes = [
            responseEvent("@ed:example.com", "pizza", 12),
            responseEvent("@rf:example.com", "pizza", 12),
            responseEvent("@th:example.com", "wings", 13),
            responseEvent("@yh:example.com", "wings", 14),
            responseEvent("@th:example.com", "poutine", 13),
            responseEvent("@yh:example.com", "poutine", 14),
        ];
        const ends = [endEvent("@me:example.com", 25)];
        const body = newMPollBody(votes, ends, null, false);
        expect(body.html()).toMatchSnapshot();
    });
});

function newVoteRelations(relationEvents: Array<MatrixEvent>): Relations {
    return newRelations(relationEvents, M_POLL_RESPONSE.name);
}

function newEndRelations(relationEvents: Array<MatrixEvent>): Relations {
    return newRelations(relationEvents, M_POLL_END.name);
}

function newRelations(
    relationEvents: Array<MatrixEvent>,
    eventType: string,
): Relations {
    const voteRelations = new Relations("m.reference", eventType, null);
    for (const ev of relationEvents) {
        voteRelations.addEvent(ev);
    }
    return voteRelations;
}

function newMPollBody(
    relationEvents: Array<MatrixEvent>,
    endEvents: Array<MatrixEvent> = [],
    answers?: POLL_ANSWER[],
    disclosed = true,
): ReactWrapper {
    const mxEvent = new MatrixEvent({
        "type": M_POLL_START.name,
        "event_id": "$mypoll",
        "room_id": "#myroom:example.com",
        "content": newPollStart(answers, null, disclosed),
    });
    return newMPollBodyFromEvent(mxEvent, relationEvents, endEvents);
}

function newMPollBodyFromEvent(
    mxEvent: MatrixEvent,
    relationEvents: Array<MatrixEvent>,
    endEvents: Array<MatrixEvent> = [],
): ReactWrapper {
    const voteRelations = newVoteRelations(relationEvents);
    const endRelations = newEndRelations(endEvents);
    return mount(<MPollBody
        mxEvent={mxEvent}
        getRelationsForEvent={
            (eventId: string, relationType: string, eventType: string) => {
                expect(eventId).toBe("$mypoll");
                expect(relationType).toBe("m.reference");
                if (M_POLL_RESPONSE.matches(eventType)) {
                    return voteRelations;
                } else if (M_POLL_END.matches(eventType)) {
                    return endRelations;
                } else {
                    fail("Unexpected eventType: " + eventType);
                }
            }
        }

        // We don't use any of these props, but they're required.
        highlightLink="unused"
        highlights={[]}
        mediaEventHelper={null}
        onHeightChanged={() => {}}
        onMessageAllowed={() => {}}
        permalinkCreator={null}
    />, {
        wrappingComponent: MatrixClientContext.Provider,
        wrappingComponentProps: {
            value: mockClient,
        },
    });
}

function clickRadio(wrapper: ReactWrapper, value: string) {
    const div = wrapper.find(`StyledRadioButton[value="${value}"]`);
    expect(div).toHaveLength(1);
    div.simulate("click");
}

function clickEndedOption(wrapper: ReactWrapper, value: string) {
    const div = wrapper.find(`div[data-value="${value}"]`);
    expect(div).toHaveLength(1);
    div.simulate("click");
}

function voteButton(wrapper: ReactWrapper, value: string): ReactWrapper {
    return wrapper.find(
        `div.mx_MPollBody_option`,
    ).findWhere(w => w.key() === value);
}

function votesCount(wrapper: ReactWrapper, value: string): string {
    return wrapper.find(
        `StyledRadioButton[value="${value}"] .mx_MPollBody_optionVoteCount`,
    ).text();
}

function endedVoteChecked(wrapper: ReactWrapper, value: string): boolean {
    return endedVoteDiv(wrapper, value)
        .closest(".mx_MPollBody_option")
        .hasClass("mx_MPollBody_option_checked");
}

function endedVoteDiv(wrapper: ReactWrapper, value: string): ReactWrapper {
    return wrapper.find(`div[data-value="${value}"]`);
}

function endedVotesCount(wrapper: ReactWrapper, value: string): string {
    return wrapper.find(
        `div[data-value="${value}"] .mx_MPollBody_optionVoteCount`,
    ).text();
}

function newPollStart(
    answers?: POLL_ANSWER[],
    question?: string,
    disclosed = true,
): M_POLL_START_EVENT_CONTENT {
    if (!answers) {
        answers = [
            { "id": "pizza", [M_TEXT.name]: "Pizza" },
            { "id": "poutine", [M_TEXT.name]: "Poutine" },
            { "id": "italian", [M_TEXT.name]: "Italian" },
            { "id": "wings", [M_TEXT.name]: "Wings" },
        ];
    }

    if (!question) {
        question = "What should we order for the party?";
    }

    const answersFallback = answers
        .map((a, i) => `${i + 1}. ${a[M_TEXT.name]}`)
        .join("\n");

    const fallback = `${question}\n${answersFallback}`;

    return {
        [M_POLL_START.name]: {
            "question": {
                [M_TEXT.name]: question,
            },
            "kind": (
                disclosed
                    ? M_POLL_KIND_DISCLOSED.name
                    : M_POLL_KIND_UNDISCLOSED.name
            ),
            "answers": answers,
        },
        [M_TEXT.name]: fallback,
    };
}

function badResponseEvent(): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": M_POLL_RESPONSE.name,
            "sender": "@malicious:example.com",
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                // Does not actually contain a response
            },
        },
    );
}

function responseEvent(
    sender = "@alice:example.com",
    answers: string | Array<string> = "italian",
    ts = 0,
): MatrixEvent {
    const ans = typeof answers === "string" ? [answers] : answers;
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "room_id": "#myroom:example.com",
            "origin_server_ts": ts,
            "type": M_POLL_RESPONSE.name,
            "sender": sender,
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                [M_POLL_RESPONSE.name]: {
                    "answers": ans,
                },
            },
        },
    );
}

function expectedResponseEvent(answer: string) {
    return {
        "content": {
            [M_POLL_RESPONSE.name]: {
                "answers": [answer],
            },
            "m.relates_to": {
                "event_id": "$mypoll",
                "rel_type": "m.reference",
            },
        },
        "roomId": "#myroom:example.com",
        "eventType": M_POLL_RESPONSE.name,
        "txnId": undefined,
        "callback": undefined,
    };
}
function expectedResponseEventCall(answer: string) {
    const {
        content, roomId, eventType,
    } = expectedResponseEvent(answer);
    return [
        roomId, eventType, content,
    ];
}

function endEvent(
    sender = "@me:example.com",
    ts = 0,
): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "room_id": "#myroom:example.com",
            "origin_server_ts": ts,
            "type": M_POLL_END.name,
            "sender": sender,
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                [M_POLL_END.name]: {},
                [M_TEXT.name]: "The poll has ended. Something.",
            },
        },
    );
}

function runIsPollEnded(ends: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        "event_id": "$mypoll",
        "room_id": "#myroom:example.com",
        "type": M_POLL_START.name,
        "content": newPollStart(),
    });

    setRedactionAllowedForMeOnly(mockClient);

    const getRelationsForEvent =
        (eventId: string, relationType: string, eventType: string) => {
            expect(eventId).toBe("$mypoll");
            expect(relationType).toBe("m.reference");
            expect(M_POLL_END.matches(eventType)).toBe(true);
            return newEndRelations(ends);
        };

    return isPollEnded(pollEvent, mockClient, getRelationsForEvent);
}

function runFindTopAnswer(votes: MatrixEvent[], ends: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        "event_id": "$mypoll",
        "room_id": "#myroom:example.com",
        "type": M_POLL_START.name,
        "content": newPollStart(),
    });

    const getRelationsForEvent =
        (eventId: string, relationType: string, eventType: string) => {
            expect(eventId).toBe("$mypoll");
            expect(relationType).toBe("m.reference");
            if (M_POLL_RESPONSE.matches(eventType)) {
                return newVoteRelations(votes);
            } else if (M_POLL_END.matches(eventType)) {
                return newEndRelations(ends);
            } else {
                fail(`eventType should be end or vote but was ${eventType}`);
            }
        };

    return findTopAnswer(pollEvent, MatrixClientPeg.get(), getRelationsForEvent);
}

function setRedactionAllowedForMeOnly(matrixClient: MockedObject<MatrixClient>) {
    matrixClient.getRoom.mockImplementation((_roomId: string) => {
        return {
            currentState: {
                maySendRedactionForEvent: (_evt: MatrixEvent, userId: string) => {
                    return userId === "@me:example.com";
                },
            },
        } as Room;
    });
}

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
