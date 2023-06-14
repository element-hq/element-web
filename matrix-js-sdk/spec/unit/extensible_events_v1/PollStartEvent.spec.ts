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

import { M_TEXT, IPartialEvent } from "../../../src/@types/extensible_events";
import {
    M_POLL_START,
    M_POLL_KIND_DISCLOSED,
    PollAnswer,
    PollStartEventContent,
    M_POLL_KIND_UNDISCLOSED,
} from "../../../src/@types/polls";
import { PollStartEvent, PollAnswerSubevent } from "../../../src/extensible_events_v1/PollStartEvent";
import { InvalidEventError } from "../../../src/extensible_events_v1/InvalidEventError";

describe("PollAnswerSubevent", () => {
    // Note: throughout these tests we don't really bother testing that
    // MessageEvent is doing its job. It has its own tests to worry about.

    it("should parse an answer representation", () => {
        const input: IPartialEvent<PollAnswer> = {
            type: "org.matrix.sdk.poll.answer",
            content: {
                id: "one",
                [M_TEXT.name]: "ONE",
            },
        };
        const answer = new PollAnswerSubevent(input);
        expect(answer.id).toBe("one");
        expect(answer.text).toBe("ONE");
    });

    it("should fail to parse answers without an ID", () => {
        const input: IPartialEvent<PollAnswer> = {
            type: "org.matrix.sdk.poll.answer",
            content: {
                [M_TEXT.name]: "ONE",
            } as any, // force invalid type
        };
        expect(() => new PollAnswerSubevent(input)).toThrow(
            new InvalidEventError("Answer ID must be a non-empty string"),
        );
    });

    it("should fail to parse answers without text", () => {
        const input: IPartialEvent<PollAnswer> = {
            type: "org.matrix.sdk.poll.answer",
            content: {
                id: "one",
            } as any, // force invalid type
        };
        expect(() => new PollAnswerSubevent(input)).toThrow(); // we don't check message - that'll be MessageEvent's problem
    });

    describe("from & serialize", () => {
        it("should serialize to a placeholder representation", () => {
            const answer = PollAnswerSubevent.from("one", "ONE");
            expect(answer.id).toBe("one");
            expect(answer.text).toBe("ONE");

            const serialized = answer.serialize();
            expect(serialized.type).toBe("org.matrix.sdk.poll.answer");
            expect(serialized.content).toMatchObject({
                id: "one",
                [M_TEXT.name]: expect.any(String), // tested by MessageEvent
            });
        });
    });
});

describe("PollStartEvent", () => {
    // Note: throughout these tests we don't really bother testing that
    // MessageEvent is doing its job. It has its own tests to worry about.

    it("should parse a poll", () => {
        const input: IPartialEvent<PollStartEventContent> = {
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
        };
        const poll = new PollStartEvent(input);
        expect(poll.question).toBeDefined();
        expect(poll.question.text).toBe("Question here");
        expect(poll.kind).toBe(M_POLL_KIND_DISCLOSED);
        expect(M_POLL_KIND_DISCLOSED.matches(poll.rawKind)).toBe(true);
        expect(poll.maxSelections).toBe(2);
        expect(poll.answers.length).toBe(3);
        expect(poll.answers.some((a) => a.id === "one" && a.text === "ONE")).toBe(true);
        expect(poll.answers.some((a) => a.id === "two" && a.text === "TWO")).toBe(true);
        expect(poll.answers.some((a) => a.id === "thr" && a.text === "THR")).toBe(true);
    });

    it("should fail to parse a missing question", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: [
                        { id: "one", [M_TEXT.name]: "ONE" },
                        { id: "two", [M_TEXT.name]: "TWO" },
                        { id: "thr", [M_TEXT.name]: "THR" },
                    ],
                },
            } as any, // force invalid type
        };
        expect(() => new PollStartEvent(input)).toThrow(new InvalidEventError("A question is required"));
    });

    it("should fail to parse non-array answers", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: "one",
                } as any, // force invalid type
            },
        };
        expect(() => new PollStartEvent(input)).toThrow(new InvalidEventError("Poll answers must be an array"));
    });

    it("should fail to parse invalid answers", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: [{ id: "one" }, { [M_TEXT.name]: "TWO" }],
                } as any, // force invalid type
            },
        };
        expect(() => new PollStartEvent(input)).toThrow(); // error tested by PollAnswerSubevent tests
    });

    it("should fail to parse lack of answers", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: [],
                } as any, // force invalid type
            },
        };
        expect(() => new PollStartEvent(input)).toThrow(new InvalidEventError("No answers available"));
    });

    it("should truncate answers at 20", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: [
                        { id: "01", [M_TEXT.name]: "A" },
                        { id: "02", [M_TEXT.name]: "B" },
                        { id: "03", [M_TEXT.name]: "C" },
                        { id: "04", [M_TEXT.name]: "D" },
                        { id: "05", [M_TEXT.name]: "E" },
                        { id: "06", [M_TEXT.name]: "F" },
                        { id: "07", [M_TEXT.name]: "G" },
                        { id: "08", [M_TEXT.name]: "H" },
                        { id: "09", [M_TEXT.name]: "I" },
                        { id: "10", [M_TEXT.name]: "J" },
                        { id: "11", [M_TEXT.name]: "K" },
                        { id: "12", [M_TEXT.name]: "L" },
                        { id: "13", [M_TEXT.name]: "M" },
                        { id: "14", [M_TEXT.name]: "N" },
                        { id: "15", [M_TEXT.name]: "O" },
                        { id: "16", [M_TEXT.name]: "P" },
                        { id: "17", [M_TEXT.name]: "Q" },
                        { id: "18", [M_TEXT.name]: "R" },
                        { id: "19", [M_TEXT.name]: "S" },
                        { id: "20", [M_TEXT.name]: "T" },
                        { id: "FAIL", [M_TEXT.name]: "U" },
                    ],
                },
            },
        };
        const poll = new PollStartEvent(input);
        expect(poll.answers.length).toBe(20);
        expect(poll.answers.some((a) => a.id === "FAIL")).toBe(false);
    });

    it("should infer a kind from unknown kinds", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    kind: "org.example.custom.poll.kind",
                    max_selections: 2,
                    answers: [
                        { id: "01", [M_TEXT.name]: "A" },
                        { id: "02", [M_TEXT.name]: "B" },
                        { id: "03", [M_TEXT.name]: "C" },
                    ],
                },
            },
        };
        const poll = new PollStartEvent(input);
        expect(poll.kind).toBe(M_POLL_KIND_UNDISCLOSED);
        expect(poll.rawKind).toBe("org.example.custom.poll.kind");
    });

    it("should infer a kind from missing kinds", () => {
        const input: IPartialEvent<PollStartEventContent> = {
            type: M_POLL_START.name,
            content: {
                [M_TEXT.name]: "FALLBACK Question here",
                [M_POLL_START.name]: {
                    question: { [M_TEXT.name]: "Question here" },
                    max_selections: 2,
                    answers: [
                        { id: "01", [M_TEXT.name]: "A" },
                        { id: "02", [M_TEXT.name]: "B" },
                        { id: "03", [M_TEXT.name]: "C" },
                    ],
                } as any, // force invalid type
            },
        };
        const poll = new PollStartEvent(input);
        expect(poll.kind).toBe(M_POLL_KIND_UNDISCLOSED);
        expect(poll.rawKind).toBeFalsy();
    });

    describe("from & serialize", () => {
        it("should serialize to a poll start event", () => {
            const poll = PollStartEvent.from("Question here", ["A", "B", "C"], M_POLL_KIND_DISCLOSED, 2);
            expect(poll.question.text).toBe("Question here");
            expect(poll.kind).toBe(M_POLL_KIND_DISCLOSED);
            expect(M_POLL_KIND_DISCLOSED.matches(poll.rawKind)).toBe(true);
            expect(poll.maxSelections).toBe(2);
            expect(poll.answers.length).toBe(3);
            expect(poll.answers.some((a) => a.text === "A")).toBe(true);
            expect(poll.answers.some((a) => a.text === "B")).toBe(true);
            expect(poll.answers.some((a) => a.text === "C")).toBe(true);

            // Ids are non-empty and unique
            expect(poll.answers[0].id).toHaveLength(16);
            expect(poll.answers[1].id).toHaveLength(16);
            expect(poll.answers[2].id).toHaveLength(16);
            expect(poll.answers[0].id).not.toEqual(poll.answers[1].id);
            expect(poll.answers[0].id).not.toEqual(poll.answers[2].id);
            expect(poll.answers[1].id).not.toEqual(poll.answers[2].id);

            const serialized = poll.serialize();
            expect(M_POLL_START.matches(serialized.type)).toBe(true);
            expect(serialized.content).toMatchObject({
                [M_TEXT.name]: "Question here\n1. A\n2. B\n3. C",
                [M_POLL_START.name]: {
                    question: {
                        [M_TEXT.name]: expect.any(String), // tested by MessageEvent tests
                    },
                    kind: M_POLL_KIND_DISCLOSED.name,
                    max_selections: 2,
                    answers: [
                        // M_TEXT tested by MessageEvent tests
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                    ],
                },
            });
        });

        it("should serialize to a custom kind poll start event", () => {
            const poll = PollStartEvent.from("Question here", ["A", "B", "C"], "org.example.poll.kind", 2);
            expect(poll.question.text).toBe("Question here");
            expect(poll.kind).toBe(M_POLL_KIND_UNDISCLOSED);
            expect(poll.rawKind).toBe("org.example.poll.kind");
            expect(poll.maxSelections).toBe(2);
            expect(poll.answers.length).toBe(3);
            expect(poll.answers.some((a) => a.text === "A")).toBe(true);
            expect(poll.answers.some((a) => a.text === "B")).toBe(true);
            expect(poll.answers.some((a) => a.text === "C")).toBe(true);

            const serialized = poll.serialize();
            expect(M_POLL_START.matches(serialized.type)).toBe(true);
            expect(serialized.content).toMatchObject({
                [M_TEXT.name]: "Question here\n1. A\n2. B\n3. C",
                [M_POLL_START.name]: {
                    question: {
                        [M_TEXT.name]: expect.any(String), // tested by MessageEvent tests
                    },
                    kind: "org.example.poll.kind",
                    max_selections: 2,
                    answers: [
                        // M_MESSAGE tested by MessageEvent tests
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                        { id: expect.any(String), [M_TEXT.name]: expect.any(String) },
                    ],
                },
            });
        });
    });
});
