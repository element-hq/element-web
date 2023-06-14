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

import { M_TEXT, IPartialEvent, REFERENCE_RELATION } from "../../../src/@types/extensible_events";
import {
    M_POLL_START,
    M_POLL_KIND_DISCLOSED,
    PollResponseEventContent,
    M_POLL_RESPONSE,
} from "../../../src/@types/polls";
import { PollStartEvent } from "../../../src/extensible_events_v1/PollStartEvent";
import { InvalidEventError } from "../../../src/extensible_events_v1/InvalidEventError";
import { PollResponseEvent } from "../../../src/extensible_events_v1/PollResponseEvent";

const SAMPLE_POLL = new PollStartEvent({
    type: M_POLL_START.name,
    content: {
        [M_TEXT.name]: "FALLBACK Question here",
        [M_POLL_START.name]: {
            question: { [M_TEXT.name]: "Question here" },
            kind: M_POLL_KIND_DISCLOSED.name,
            max_selections: 2,
            answers: [
                { id: "one", [M_TEXT.name]: "ONE" },
                { id: "two", [M_TEXT.name]: "TWO" },
                { id: "thr", [M_TEXT.name]: "THR" },
            ],
        },
    },
});

describe("PollResponseEvent", () => {
    it("should parse a poll response", () => {
        const input: IPartialEvent<PollResponseEventContent> = {
            type: M_POLL_RESPONSE.name,
            content: {
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: "$poll",
                },
                [M_POLL_RESPONSE.name]: {
                    answers: ["one"],
                },
            },
        };
        const response = new PollResponseEvent(input);
        expect(response.spoiled).toBe(false);
        expect(response.answerIds).toMatchObject(["one"]);
        expect(response.pollEventId).toBe("$poll");
    });

    it("should fail to parse a missing relationship", () => {
        const input: IPartialEvent<PollResponseEventContent> = {
            type: M_POLL_RESPONSE.name,
            content: {
                [M_POLL_RESPONSE.name]: {
                    answers: ["one"],
                },
            } as any, // force invalid type
        };
        expect(() => new PollResponseEvent(input)).toThrow(
            new InvalidEventError("Relationship must be a reference to an event"),
        );
    });

    it("should fail to parse a missing relationship event ID", () => {
        const input: IPartialEvent<PollResponseEventContent> = {
            type: M_POLL_RESPONSE.name,
            content: {
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                },
                [M_POLL_RESPONSE.name]: {
                    answers: ["one"],
                },
            } as any, // force invalid type
        };
        expect(() => new PollResponseEvent(input)).toThrow(
            new InvalidEventError("Relationship must be a reference to an event"),
        );
    });

    it("should fail to parse an improper relationship", () => {
        const input: IPartialEvent<PollResponseEventContent> = {
            type: M_POLL_RESPONSE.name,
            content: {
                "m.relates_to": {
                    rel_type: "org.example.not-relationship",
                    event_id: "$poll",
                },
                [M_POLL_RESPONSE.name]: {
                    answers: ["one"],
                },
            } as any, // force invalid type
        };
        expect(() => new PollResponseEvent(input)).toThrow(
            new InvalidEventError("Relationship must be a reference to an event"),
        );
    });

    describe("validateAgainst", () => {
        it("should spoil the vote when no answers", () => {
            const input: IPartialEvent<PollResponseEventContent> = {
                type: M_POLL_RESPONSE.name,
                content: {
                    "m.relates_to": {
                        rel_type: REFERENCE_RELATION.name,
                        event_id: "$poll",
                    },
                    [M_POLL_RESPONSE.name]: {},
                } as any, // force invalid type
            };
            const response = new PollResponseEvent(input);
            expect(response.spoiled).toBe(true);

            response.validateAgainst(SAMPLE_POLL);
            expect(response.spoiled).toBe(true);
        });

        it("should spoil the vote when answers are empty", () => {
            const input: IPartialEvent<PollResponseEventContent> = {
                type: M_POLL_RESPONSE.name,
                content: {
                    "m.relates_to": {
                        rel_type: REFERENCE_RELATION.name,
                        event_id: "$poll",
                    },
                    [M_POLL_RESPONSE.name]: {
                        answers: [],
                    },
                },
            };
            const response = new PollResponseEvent(input);
            expect(response.spoiled).toBe(true);

            response.validateAgainst(SAMPLE_POLL);
            expect(response.spoiled).toBe(true);
        });

        it("should spoil the vote when answers are not strings", () => {
            const input: IPartialEvent<PollResponseEventContent> = {
                type: M_POLL_RESPONSE.name,
                content: {
                    "m.relates_to": {
                        rel_type: REFERENCE_RELATION.name,
                        event_id: "$poll",
                    },
                    [M_POLL_RESPONSE.name]: {
                        answers: [1, 2, 3],
                    },
                } as any, // force invalid type
            };
            const response = new PollResponseEvent(input);
            expect(response.spoiled).toBe(true);

            response.validateAgainst(SAMPLE_POLL);
            expect(response.spoiled).toBe(true);
        });

        describe("consumer usage", () => {
            it("should spoil the vote when invalid answers are given", () => {
                const input: IPartialEvent<PollResponseEventContent> = {
                    type: M_POLL_RESPONSE.name,
                    content: {
                        "m.relates_to": {
                            rel_type: REFERENCE_RELATION.name,
                            event_id: "$poll",
                        },
                        [M_POLL_RESPONSE.name]: {
                            answers: ["A", "B", "C"],
                        },
                    },
                };
                const response = new PollResponseEvent(input);
                expect(response.spoiled).toBe(false); // it won't know better

                response.validateAgainst(SAMPLE_POLL);
                expect(response.spoiled).toBe(true);
            });

            it("should truncate answers to the poll max selections", () => {
                const input: IPartialEvent<PollResponseEventContent> = {
                    type: M_POLL_RESPONSE.name,
                    content: {
                        "m.relates_to": {
                            rel_type: REFERENCE_RELATION.name,
                            event_id: "$poll",
                        },
                        [M_POLL_RESPONSE.name]: {
                            answers: ["one", "two", "thr"],
                        },
                    },
                };
                const response = new PollResponseEvent(input);
                expect(response.spoiled).toBe(false); // it won't know better
                expect(response.answerIds).toMatchObject(["one", "two", "thr"]);

                response.validateAgainst(SAMPLE_POLL);
                expect(response.spoiled).toBe(false);
                expect(response.answerIds).toMatchObject(["one", "two"]);
            });
        });
    });

    describe("from & serialize", () => {
        it("should serialize to a poll response event", () => {
            const response = PollResponseEvent.from(["A", "B", "C"], "$poll");
            expect(response.spoiled).toBe(false);
            expect(response.answerIds).toMatchObject(["A", "B", "C"]);
            expect(response.pollEventId).toBe("$poll");

            const serialized = response.serialize();
            expect(M_POLL_RESPONSE.matches(serialized.type)).toBe(true);
            expect(serialized.content).toMatchObject({
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: "$poll",
                },
                [M_POLL_RESPONSE.name]: {
                    answers: ["A", "B", "C"],
                },
            });
        });

        it("should serialize a spoiled vote", () => {
            const response = PollResponseEvent.from([], "$poll");
            expect(response.spoiled).toBe(true);
            expect(response.answerIds).toMatchObject([]);
            expect(response.pollEventId).toBe("$poll");

            const serialized = response.serialize();
            expect(M_POLL_RESPONSE.matches(serialized.type)).toBe(true);
            expect(serialized.content).toMatchObject({
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: "$poll",
                },
                [M_POLL_RESPONSE.name]: {
                    answers: undefined,
                },
            });
        });
    });
});
