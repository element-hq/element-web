/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import { EventContext } from "matrix-js-sdk/src/models/event-context"; // eslint-disable-line
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    findAllMatches,
    eventMatchesSearchTerms,
    makeSearchTermObject,
    isMemberMatch,
    SearchTerm,
    reverseEventContext,
} from "../src/VerjiLocalSearch";

describe("LocalSearch", () => {
    it("should return true for matches", async () => {
        const testEvent = {} as MatrixEvent;
        testEvent.getType = () => "m.room.message";
        testEvent.isRedacted = () => false;
        testEvent.getContent = () => ({ body: "bodytext" }) as any;
        testEvent.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent.getDate = () => new Date();

        const termObj: SearchTerm = {
            searchTypeAdvanced: false,
            searchTypeNormal: true,
            fullText: "bodytext",
            words: [{ word: "bodytext", highlight: false }],
            regExpHighlights: [],
        };

        const isMatch = eventMatchesSearchTerms(termObj, testEvent as MatrixEvent, [] as any);
        expect(isMatch).toBe(true);
    });

    it("finds only one match among several", async () => {
        const testEvent = {} as MatrixEvent;
        testEvent.getType = () => "m.room.message";
        testEvent.isRedacted = () => false;
        testEvent.getContent = () => ({ body: "bodytext" }) as any;
        testEvent.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent.getDate = () => new Date();

        const testEvent2 = {} as MatrixEvent;
        testEvent2.getType = () => "m.room.message";
        testEvent2.isRedacted = () => false;
        testEvent2.getContent = () => ({ body: "not that text at all" }) as any;
        testEvent2.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent2.getDate = () => new Date();

        const testEvent3 = {} as MatrixEvent;
        testEvent3.getType = () => "m.room.message";
        testEvent3.isRedacted = () => false;
        testEvent3.getContent = () => ({ body: "some different text that doesn't match" }) as any;
        testEvent3.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent3.getDate = () => new Date();

        const room = {
            getLiveTimeline: () => {
                const timeline = {} as any;
                timeline.getEvents = () => [testEvent, testEvent2, testEvent3];
                timeline.getNeighbouringTimeline = () => null;
                return timeline;
            },
            currentState: {
                getMembers: () => [{ name: "Name Namesson", userId: "testtestsson" }],
            },
        };

        const termObj = {
            searchTypeAdvanced: false,
            searchTypeNormal: true,
            fullText: "bodytext",
            words: [{ word: "bodytext", highlight: false }],
            regExpHighlights: [],
        };

        const matches = await findAllMatches(termObj, room as any, [] as any);
        expect(matches.length).toBe(1);
    });

    it("finds several different with advanced search", async () => {
        const testEvent = {} as MatrixEvent;
        testEvent.getType = () => "m.room.message";
        testEvent.isRedacted = () => false;
        testEvent.getContent = () => ({ body: "body text" }) as any;
        testEvent.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent.getDate = () => new Date();

        const testEvent2 = {} as MatrixEvent;
        testEvent2.getType = () => "m.room.message";
        testEvent2.isRedacted = () => false;
        testEvent2.getContent = () => ({ body: "not that text at all" }) as any;
        testEvent2.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent2.getDate = () => new Date();

        const testEvent3 = {} as MatrixEvent;
        testEvent3.getType = () => "m.room.message";
        testEvent3.isRedacted = () => false;
        testEvent3.getContent = () => ({ body: "some different text that doesn't match" }) as any;
        testEvent3.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent3.getDate = () => new Date();

        const testEvent4 = {} as MatrixEvent;
        testEvent4.getType = () => "m.room.message";
        testEvent4.isRedacted = () => false;
        testEvent4.getContent = () => ({ body: "a text that isn't found" }) as any;
        testEvent4.getSender = () => ({ userId: "testtestsson" }) as any;
        testEvent4.getDate = () => new Date();

        const room = {
            getLiveTimeline: () => {
                const timeline = {} as any;
                timeline.getEvents = () => [testEvent, testEvent2, testEvent3, testEvent4];
                timeline.getNeighbouringTimeline = () => null;
                return timeline;
            },
        };

        const termObj = makeSearchTermObject("rx:(body|all|some)");
        expect(termObj.searchTypeAdvanced).toBe(true);

        const matches = await findAllMatches(termObj, room as any, [] as any);
        expect(matches.length).toBe(3);
    });

    it("should be able to find messages sent by specific members", async () => {
        const testEvent = {} as MatrixEvent;
        testEvent.getType = () => "m.room.message";
        testEvent.isRedacted = () => false;
        testEvent.getContent = () => ({ body: "body text Santa Clause" }) as any;
        testEvent.getSender = () => "testtestssen" as any;
        testEvent.getDate = () => new Date();

        const testEvent2 = {} as MatrixEvent;
        testEvent2.getType = () => "m.room.message";
        testEvent2.isRedacted = () => false;
        testEvent2.getContent = () => ({ body: "not that text at all" }) as any;
        testEvent2.getSender = () => "namerssen" as any;
        testEvent2.getDate = () => new Date();

        const testEvent3 = {} as MatrixEvent;
        testEvent3.getType = () => "m.room.message";
        testEvent3.isRedacted = () => false;
        testEvent3.getContent = () => ({ body: "some different text, but not the one Testsson" }) as any;
        testEvent3.getSender = () => "namersson" as any;
        testEvent3.getDate = () => new Date();

        const testEvent4 = {} as MatrixEvent;
        testEvent4.getType = () => "m.room.message";
        testEvent4.isRedacted = () => false;
        testEvent4.getContent = () => ({ body: "a text" }) as any;
        testEvent4.getSender = () => "testtestsson" as any;
        testEvent4.getDate = () => new Date();

        const room = {
            getLiveTimeline: () => {
                const timeline = {} as any;
                timeline.getEvents = () => [testEvent, testEvent2, testEvent3, testEvent4];
                timeline.getNeighbouringTimeline = () => null;
                return timeline;
            },
        };

        const foundUsers = {
            ["testtestsson"]: { name: "Test Testsson", userId: "testtestsson" },
        };

        const termObj = makeSearchTermObject("Testsson");
        const matches = await findAllMatches(termObj, room as any, foundUsers);

        expect(matches.length).toBe(2);
        expect(matches[0].result.getSender()).toBe("testtestsson");
        expect(matches[1].result.getSender()).toBe("namersson");
    });

    it("can find by ISO date", async () => {
        const testEvent = {} as MatrixEvent;
        testEvent.getType = () => "m.room.message";
        testEvent.isRedacted = () => false;
        testEvent.getContent = () => ({ body: "body text" }) as any;
        testEvent.getSender = () => "testtestsson" as any;
        testEvent.getDate = () => new Date(2020, 10, 2, 13, 30, 0);

        const testEvent2 = {} as MatrixEvent;
        testEvent2.getType = () => "m.room.message";
        testEvent2.isRedacted = () => false;
        testEvent2.getContent = () => ({ body: "not that text at all" }) as any;
        testEvent2.getSender = () => "namersson" as any;
        testEvent2.getDate = () => new Date(2020, 9, 28, 14, 0, 0);

        const room = {
            getLiveTimeline: () => {
                const timeline = {
                    getEvents: () => [testEvent, testEvent2],
                    getNeighbouringTimeline: () => null,
                };
                return timeline;
            },
        };

        const foundUsers = {};
        const termObj = makeSearchTermObject("2020-10-28");
        const matches = await findAllMatches(termObj, room as any, foundUsers);
        expect(matches.length).toBe(1);
        expect(matches[0].result.getSender()).toBe("namersson");
    });

    it("matches users", async () => {
        const termObj = makeSearchTermObject("Namesson");
        const isMatch = isMemberMatch({ name: "Name Namesson", userId: "namenamesson" } as any, termObj);
        expect(isMatch).toBe(true);
    });

    it("should reverse the timeline", () => {
        const testEvent1 = {} as MatrixEvent;
        testEvent1.getType = () => "m.room.message";
        testEvent1.isRedacted = () => false;
        testEvent1.getContent = () => ({ body: "body text Santa Clause" }) as any;
        testEvent1.getSender = () => "testtestssen" as any;
        testEvent1.getDate = () => new Date();
        testEvent1.getId = () => "1";

        const testEvent2 = {} as MatrixEvent;
        testEvent2.getType = () => "m.room.message";
        testEvent2.isRedacted = () => false;
        testEvent2.getContent = () => ({ body: "not that text at all" }) as any;
        testEvent2.getSender = () => "namerssen" as any;
        testEvent2.getDate = () => new Date();
        testEvent2.getId = () => "2";

        const testEvent3 = {} as MatrixEvent;
        testEvent3.getType = () => "m.room.message";
        testEvent3.isRedacted = () => false;
        testEvent3.getContent = () => ({ body: "some different text, but not the one Testsson" }) as any;
        testEvent3.getSender = () => "namersson" as any;
        testEvent3.getDate = () => new Date();
        testEvent3.getId = () => "3";

        const mockEventContext = {
            getTimeline: () => [testEvent1, testEvent2, testEvent3],
            getOurEventIndex: () => 1,
            getEvent: () => testEvent2,
            addEvents: jest.fn(),
        };

        const eventContext = mockEventContext as unknown as EventContext;

        const reversedContext = reverseEventContext(eventContext);

        expect(reversedContext.getTimeline()[0].getId()).toEqual("3");
        expect(reversedContext.getTimeline()[1].getId()).toEqual("2");
        expect(reversedContext.getTimeline()[2].getId()).toEqual("1");
    });
});
