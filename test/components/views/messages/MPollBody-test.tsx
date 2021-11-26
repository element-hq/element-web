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

import sdk from "../../../skinned-sdk";
import * as TestUtils from "../../../test-utils";

import { Callback, IContent, MatrixEvent } from "matrix-js-sdk";
import { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { IPollAnswer, IPollContent } from "../../../../src/polls/consts";
import { UserVote, allVotes } from "../../../../src/components/views/messages/MPollBody";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

const CHECKED = "mx_MPollBody_option_checked";

const _MPollBody = sdk.getComponent("views.messages.MPollBody");
const MPollBody = TestUtils.wrapInMatrixClientContext(_MPollBody);

MatrixClientPeg.matrixClient = {
    getUserId: () => "@me:example.com",
    sendEvent: () => Promise.resolve({ "event_id": "fake_send_id" }),
};

describe("MPollBody", () => {
    it("finds no votes if there are none", () => {
        expect(allVotes(newPollRelations([]))).toEqual([]);
    });

    it("can find all the valid responses to a poll", () => {
        const ev1 = responseEvent();
        const ev2 = responseEvent();
        const badEvent = badResponseEvent();

        const pollRelations = newPollRelations([ev1, badEvent, ev2]);
        expect(allVotes(pollRelations)).toEqual([
            new UserVote(
                ev1.getTs(),
                ev1.getSender(),
                ev1.getContent()["org.matrix.msc3381.poll.response"].answers,
            ),
            new UserVote(
                ev2.getTs(),
                ev2.getSender(),
                ev2.getContent()["org.matrix.msc3381.poll.response"].answers,
            ),
        ]);
    });

    it("finds no votes if none were made", () => {
        const votes = [];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("0 votes");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 0 votes");
    });

    it("finds votes from multiple people", () => {
        const votes = [
            responseEvent("@andyb:example.com", "pizza"),
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

    it("takes someone's most recent vote if they voted several times", () => {
        const votes = [
            responseEvent("@fiona:example.com", "pizza", 12),
            responseEvent("@fiona:example.com", "wings", 20),   // latest fiona
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
            responseEvent("@da:example.com", "wings"),
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
            responseEvent("@md:example.com", "italian"),
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
            responseEvent("@qr:example.com", "italian"),
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
            responseEvent("@tr:example.com", "pizza", 12),
            responseEvent("@tr:example.com", ["pizza", "doesntexist"], 13),
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
            responseEvent("@tr:example.com", "pizza", 12),
            responseEvent("@tr:example.com", ["pizza", "doesntexist"], 13),
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@uy:example.com", "doesntexist", 15),
            responseEvent("@uy:example.com", "poutine", 16),
        ];
        const body = newMPollBody(votes);
        expect(votesCount(body, "pizza")).toBe("0 votes");
        expect(votesCount(body, "poutine")).toBe("1 vote");
        expect(votesCount(body, "italian")).toBe("0 votes");
        expect(votesCount(body, "wings")).toBe("0 votes");
        expect(body.find(".mx_MPollBody_totalVotes").text()).toBe("Based on 1 vote");
    });

    it("renders nothing if poll has no answers", () => {
        const answers = [];
        const votes = [];
        const body = newMPollBody(votes, answers);
        expect(body.html()).toBe("");
    });

    it("renders nothing if poll has more than 20 answers", () => {
        const answers = [...Array(21).keys()].map((i) => {
            return { "id": `id${i}`, "org.matrix.msc1767.text": `Name ${i}` };
        });
        const votes = [];
        const body = newMPollBody(votes, answers);
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
            receivedEvents.push( { roomId, eventType, content, txnId, callback } );
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
            receivedEvents.push( { roomId, eventType, content, txnId, callback } );
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

    it("sends several events when I click different options", () => {
        const receivedEvents = [];
        MatrixClientPeg.matrixClient.sendEvent = (
            roomId: string,
            eventType: string,
            content: IContent,
            txnId?: string,
            callback?: Callback,
        ): Promise<ISendEventResponse> => {
            receivedEvents.push( { roomId, eventType, content, txnId, callback } );
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
            responseEvent("@st:example.com", "wings", 15),
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
});

function newPollRelations(relationEvents: Array<MatrixEvent>): Relations {
    const pollRelations = new Relations(
        "m.reference", "org.matrix.msc3381.poll.response", null);
    for (const ev of relationEvents) {
        pollRelations.addEvent(ev);
    }
    return pollRelations;
}

function newMPollBody(
    relationEvents: Array<MatrixEvent>,
    answers?: IPollAnswer[],
): ReactWrapper {
    const pollRelations = new Relations(
        "m.reference", "org.matrix.msc3381.poll.response", null);
    for (const ev of relationEvents) {
        pollRelations.addEvent(ev);
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
                expect(eventType).toBe("org.matrix.msc3381.poll.response");
                return pollRelations;
            }
        }
    />);
}

function clickRadio(wrapper: ReactWrapper, value: string) {
    wrapper.find(`StyledRadioButton[value="${value}"]`).simulate("click");
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
            "type": "org.matrix.msc3381.poll.response",
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
            "type": "org.matrix.msc3381.poll.response",
            "sender": sender,
            "content": {
                "m.relates_to": {
                    "rel_type": "m.reference",
                    "event_id": "$mypoll",
                },
                "org.matrix.msc3381.poll.response": {
                    "answers": ans,
                },
            },
        },
    );
}

function expectedResponseEvent(answer: string) {
    return {
        "content": {
            "org.matrix.msc3381.poll.response": {
                "answers": [answer],
            },
            "m.relates_to": {
                "event_id": "$mypoll",
                "rel_type": "m.reference",
            },
        },
        "eventType": "org.matrix.msc3381.poll.response",
        "roomId": "#myroom:example.com",
        "txnId": undefined,
        "callback": undefined,
    };
}

let EVENT_ID = 0;
function nextId(): string {
    EVENT_ID++;
    return EVENT_ID.toString();
}
