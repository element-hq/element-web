/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { mount, ReactWrapper } from "enzyme";
import { Callback, IContent, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import { Relations } from "matrix-js-sdk/src/models/relations";
import {
    IPollAnswer,
    IPollContent,
    POLL_END_EVENT_TYPE,
    POLL_RESPONSE_EVENT_TYPE,
} from "matrix-js-sdk/src/@types/polls";
import { TEXT_NODE_TYPE } from "matrix-js-sdk/src/@types/extensible_events";

import * as TestUtils from "../../../test-utils";
import sdk from "../../../skinned-sdk";
import {
    UserVote,
    allVotes,
    findTopAnswer,
    pollEndTs,
    isPollEnded,
} from "../../../../src/components/views/messages/MPollBody";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { IBodyProps } from "../../../../src/components/views/messages/IBodyProps";

const CHECKED = "mx_MPollBody_option_checked";

const _MPollBody = sdk.getComponent("views.messages.MPollBody");
const MPollBody = TestUtils.wrapInMatrixClientContext(_MPollBody);

MatrixClientPeg.matrixClient = {
    getUserId: () => "@me:example.com",
    sendEvent: () => Promise.resolve({ "event_id": "fake_send_id" }),
};
setRedactionAllowedForMeOnly(MatrixClientPeg.matrixClient);

describe("MPollBody", () => {
    it("finds no votes if there are none", () => {
        expect(
            allVotes(
                { getRoomId: () => "$room" } as MatrixEvent,
                MatrixClientPeg.get(),
                newVoteRelations([]),
                newEndRelations([]),
            ),
        ).toEqual([]);
    });

    it("can find all the valid responses to a poll", () => {
        const ev1 = responseEvent();
        const ev2 = responseEvent();
        const badEvent = badResponseEvent();

        const voteRelations = newVoteRelations([ev1, badEvent, ev2]);
        expect(
            allVotes(
                { getRoomId: () => "$room" } as MatrixEvent,
                MatrixClientPeg.get(),
                voteRelations,
                newEndRelations([]),
            ),
        ).toEqual([
            new UserVote(
                ev1.getTs(),
                ev1.getSender(),
                ev1.getContent()[POLL_RESPONSE_EVENT_TYPE.name].answers,
            ),
            new UserVote(
                ev2.getTs(),
                ev2.getSender(),
                ev2.getContent()[POLL_RESPONSE_EVENT_TYPE.name].answers,
            ),
        ]);
    });

    it("finds the first end poll event", () => {
        const endRelations = newEndRelations([
            endEvent("@me:example.com", 25),
            endEvent("@me:example.com", 12),
            endEvent("@me:example.com", 45),
            endEvent("@me:example.com", 13),
        ]);

        const matrixClient = TestUtils.createTestClient();
        setRedactionAllowedForMeOnly(matrixClient);

        expect(
            pollEndTs(
                { getRoomId: () => "$room" } as MatrixEvent,
                matrixClient,
                endRelations,
            ),
        ).toBe(12);
    });

    it("ignores unauthorised end poll event when finding end ts", () => {
        const endRelations = newEndRelations([
            endEvent("@me:example.com", 25),
            endEvent("@unauthorised:example.com", 12),
            endEvent("@me:example.com", 45),
            endEvent("@me:example.com", 13),
        ]);

        const matrixClient = TestUtils.createTestClient();
        setRedactionAllowedForMeOnly(matrixClient);

        expect(
            pollEndTs(
                { getRoomId: () => "$room" } as MatrixEvent,
                matrixClient,
                endRelations,
            ),
        ).toBe(13);
    });

    it("counts only votes before the end poll event", () => {
        const voteRelations = newVoteRelations([
            responseEvent("sf@matrix.org", "wings", 13),
            responseEvent("jr@matrix.org", "poutine", 40),
            responseEvent("ak@matrix.org", "poutine", 37),
            responseEvent("id@matrix.org", "wings", 13),
            responseEvent("ps@matrix.org", "wings", 19),
        ]);
        const endRelations = newEndRelations([
            endEvent("@me:example.com", 25),
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
            "$mypoll", "m.reference", POLL_RESPONSE_EVENT_TYPE.name);
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
            "$mypoll", "m.reference", POLL_RESPONSE_EVENT_TYPE.name);
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
        // Note that tr's second vote has a valid first answer, but
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
        expect(body.html()).toBe("");
    });

    it("renders nothing if poll has more than 20 answers", () => {
        const answers = [...Array(21).keys()].map((i) => {
            return { "id": `id${i}`, "org.matrix.msc1767.text": `Name ${i}` };
        });
        const votes = [];
        const ends = [];
        const body = newMPollBody(votes, ends, answers);
        expect(body.html()).toBe("");
    });

    it("sends a vote event when I choose an option", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push({ roomId, eventType, content, txnId, callback });
            return Promise.resolve({ "event_id": "fake_tracked_send_id" });
        };

        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        expect(receivedEvents).toEqual([
            expectedResponseEvent("wings"),
        ]);
    });

    it("sends only one vote event when I click several times", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push({ roomId, eventType, content, txnId, callback });
            return Promise.resolve({ "event_id": "fake_tracked_send_id" });
        };

        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        expect(receivedEvents).toEqual([
            expectedResponseEvent("wings"),
        ]);
    });

    it("sends no vote event when I click what I already chose", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push({ roomId, eventType, content, txnId, callback });
            return Promise.resolve({ "event_id": "fake_tracked_send_id" });
        };

        const votes = [responseEvent("@me:example.com", "wings")];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        clickRadio(body, "wings");
        expect(receivedEvents).toEqual([]);
    });

    it("sends several events when I click different options", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push({ roomId, eventType, content, txnId, callback });
            return Promise.resolve({ "event_id": "fake_tracked_send_id" });
        };

        const votes = [];
        const body = newMPollBody(votes);
        clickRadio(body, "wings");
        clickRadio(body, "italian");
        clickRadio(body, "poutine");
        expect(receivedEvents).toEqual([
            expectedResponseEvent("wings"),
            expectedResponseEvent("italian"),
            expectedResponseEvent("poutine"),
        ]);
    });

    it("sends no events when I click in an ended poll", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push({ roomId, eventType, content, txnId, callback });
            return Promise.resolve({ "event_id": "fake_tracked_send_id" });
        };

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
        expect(receivedEvents).toEqual([]);
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
        const matrixClient = TestUtils.createTestClient();
        setRedactionAllowedForMeOnly(matrixClient);
        expect(isPollEnded(pollEvent, matrixClient, undefined)).toBe(false);
    });

    it("says poll is not ended if asking for relations returns undefined", () => {
        const pollEvent = new MatrixEvent({
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "content": newPollStart([]),
        });
        MatrixClientPeg.matrixClient.getRoom = () => {
            return {
                currentState: {
                    maySendRedactionForEvent: (_evt: MatrixEvent, userId: string) => {
                        return userId === "@me:example.com";
                    },
                },
            };
        };
        const getRelationsForEvent =
            (eventId: string, relationType: string, eventType: string) => {
                expect(eventId).toBe("$mypoll");
                expect(relationType).toBe("m.reference");
                expect(eventType).toBe(POLL_END_EVENT_TYPE.name);
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
});

function newVoteRelations(relationEvents: Array<MatrixEvent>): Relations {
    return newRelations(relationEvents, POLL_RESPONSE_EVENT_TYPE.name);
}

function newEndRelations(relationEvents: Array<MatrixEvent>): Relations {
    return newRelations(relationEvents, POLL_END_EVENT_TYPE.name);
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
    answers?: IPollAnswer[],
): ReactWrapper {
    const voteRelations = new Relations(
        "m.reference", POLL_RESPONSE_EVENT_TYPE.name, null);
    for (const ev of relationEvents) {
        voteRelations.addEvent(ev);
    }

    const endRelations = new Relations(
        "m.reference", POLL_END_EVENT_TYPE.name, null);
    for (const ev of endEvents) {
        endRelations.addEvent(ev);
    }

    return mount(<MPollBody
        mxEvent={new MatrixEvent({
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "content": newPollStart(answers),
        })}
        getRelationsForEvent={
            (eventId: string, relationType: string, eventType: string) => {
                expect(eventId).toBe("$mypoll");
                expect(relationType).toBe("m.reference");
                if (POLL_RESPONSE_EVENT_TYPE.matches(eventType)) {
                    return voteRelations;
                } else if (POLL_END_EVENT_TYPE.matches(eventType)) {
                    return endRelations;
                } else {
                    fail("Unexpected eventType: " + eventType);
                }
            }
        }
    />);
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

function newPollStart(answers?: IPollAnswer[]): IPollContent {
    if (!answers) {
        answers = [
            { "id": "pizza", "org.matrix.msc1767.text": "Pizza" },
            { "id": "poutine", "org.matrix.msc1767.text": "Poutine" },
            { "id": "italian", "org.matrix.msc1767.text": "Italian" },
            { "id": "wings", "org.matrix.msc1767.text": "Wings" },
        ];
    }

    return {
        "org.matrix.msc3381.poll.start": {
            "question": {
                "org.matrix.msc1767.text": "What should we order for the party?",
            },
            "kind": "org.matrix.msc3381.poll.disclosed",
            "answers": answers,
        },
        "org.matrix.msc1767.text": "What should we order for the party?\n" +
            "1. Pizza\n2. Poutine\n3. Italian\n4. Wings",
    };
}

function badResponseEvent(): MatrixEvent {
    return new MatrixEvent(
        {
            "event_id": nextId(),
            "type": POLL_RESPONSE_EVENT_TYPE.name,
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
            "type": POLL_RESPONSE_EVENT_TYPE.name,
            "sender": sender,
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                [POLL_RESPONSE_EVENT_TYPE.name]: {
                    "answers": ans,
                },
            },
        },
    );
}

function expectedResponseEvent(answer: string) {
    return {
        "content": {
            [POLL_RESPONSE_EVENT_TYPE.name]: {
                "answers": [answer],
            },
            "m.relates_to": {
                "event_id": "$mypoll",
                "rel_type": "m.reference",
            },
        },
        "eventType": POLL_RESPONSE_EVENT_TYPE.name,
        "roomId": "#myroom:example.com",
        "txnId": undefined,
        "callback": undefined,
    };
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
            "type": POLL_END_EVENT_TYPE.name,
            "sender": sender,
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                [POLL_END_EVENT_TYPE.name]: {},
                [TEXT_NODE_TYPE.name]: "The poll has ended. Something.",
            },
        },
    );
}

function runIsPollEnded(ends: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        "event_id": "$mypoll",
        "room_id": "#myroom:example.com",
        "content": newPollStart(),
    });

    const matrixClient = TestUtils.createTestClient();
    setRedactionAllowedForMeOnly(matrixClient);

    const getRelationsForEvent =
        (eventId: string, relationType: string, eventType: string) => {
            expect(eventId).toBe("$mypoll");
            expect(relationType).toBe("m.reference");
            expect(eventType).toBe(POLL_END_EVENT_TYPE.name);
            return newEndRelations(ends);
        };

    return isPollEnded(pollEvent, matrixClient, getRelationsForEvent);
}

function runFindTopAnswer(votes: MatrixEvent[], ends: MatrixEvent[]) {
    const pollEvent = new MatrixEvent({
        "event_id": "$mypoll",
        "room_id": "#myroom:example.com",
        "content": newPollStart(),
    });

    const getRelationsForEvent =
        (eventId: string, relationType: string, eventType: string) => {
            expect(eventId).toBe("$mypoll");
            expect(relationType).toBe("m.reference");
            if (POLL_RESPONSE_EVENT_TYPE.matches(eventType)) {
                return newVoteRelations(votes);
            } else if (POLL_END_EVENT_TYPE.matches(eventType)) {
                return newEndRelations(ends);
            } else {
                fail(`eventType should be end or vote but was ${eventType}`);
            }
        };

    return findTopAnswer(pollEvent, MatrixClientPeg.get(), getRelationsForEvent);
}

function setRedactionAllowedForMeOnly(matrixClient: MatrixClient) {
    matrixClient.getRoom = (_roomId: string) => {
        return {
            currentState: {
                maySendRedactionForEvent: (_evt: MatrixEvent, userId: string) => {
                    return userId === "@me:example.com";
                },
            },
        } as Room;
    };
}

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
