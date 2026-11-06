/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type PropsWithChildren } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import { type MatrixClient, MatrixEvent, Relations, Room, M_POLL_RESPONSE, M_TEXT } from "matrix-js-sdk/src/matrix";
import { type PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import {
    flushPromises,
    makePollEndEvent,
    makePollResponseEvent,
    makePollStartEvent,
    setupRoomWithPollEvents,
    stubClient,
} from "test-utils";

import { allVotes, collectUserVotes, countVotes, findTopAnswer, usePollTopAnswer, UserVote } from "./polls";
import * as languageSettings from "../i18n/settings";
import MatrixClientContext from "../contexts/MatrixClientContext";

const roomId = "!room:example.com";
const pollStartEvent = makePollStartEvent("What should we order for the party?", "@me:example.com", [
    { id: "pizza", [M_TEXT.name]: "Pizza" },
    { id: "poutine", [M_TEXT.name]: "Poutine" },
    { id: "italian", [M_TEXT.name]: "Italian" },
    { id: "wings", [M_TEXT.name]: "Wings" },
]);
const pollStart = pollStartEvent.unstableExtensibleEvent as PollStartEvent;

function responseEvent(sender: string, answers: string | string[], ts: number): MatrixEvent {
    return makePollResponseEvent(
        pollStartEvent.getId()!,
        typeof answers === "string" ? [answers] : answers,
        sender,
        roomId,
        ts,
    );
}

async function newVoteRelations(votes: MatrixEvent[]): Promise<Relations> {
    const relations = new Relations("m.reference", M_POLL_RESPONSE.name, stubClient(), [M_POLL_RESPONSE.altName!]);
    for (const vote of votes) {
        await relations.addEvent(vote);
    }
    return relations;
}

async function runFindTopAnswer(votes: MatrixEvent[]): Promise<string> {
    return findTopAnswer(pollStartEvent, await newVoteRelations(votes));
}

beforeEach(() => {
    vi.spyOn(languageSettings, "getUserLanguage").mockReturnValue("en-GB");
});

describe("allVotes", () => {
    it("finds no votes if there are none", async () => {
        expect(allVotes(await newVoteRelations([]))).toEqual([]);
    });

    it("returns a vote for each response event", async () => {
        const votes = [responseEvent("@ab:example.com", "pizza", 10), responseEvent("@cd:example.com", "wings", 20)];

        expect(allVotes(await newVoteRelations(votes))).toEqual([
            new UserVote(10, "@ab:example.com", ["pizza"]),
            new UserVote(20, "@cd:example.com", ["wings"]),
        ]);
    });

    it("ignores redacted votes", async () => {
        const redacted = responseEvent("@ab:example.com", "pizza", 10);
        redacted.event.unsigned = { redacted_because: {} as never };

        expect(allVotes(await newVoteRelations([redacted, responseEvent("@cd:example.com", "wings", 20)]))).toEqual([
            new UserVote(20, "@cd:example.com", ["wings"]),
        ]);
    });
});

describe("collectUserVotes", () => {
    it("keeps only the latest vote from each user", () => {
        const userVotes = collectUserVotes([
            new UserVote(20, "@ab:example.com", ["wings"]),
            new UserVote(10, "@ab:example.com", ["pizza"]),
            new UserVote(15, "@cd:example.com", ["italian"]),
        ]);

        expect(userVotes).toEqual(
            new Map([
                ["@ab:example.com", new UserVote(20, "@ab:example.com", ["wings"])],
                ["@cd:example.com", new UserVote(15, "@cd:example.com", ["italian"])],
            ]),
        );
    });

    it("replaces the user's vote with their local selection", () => {
        const userVotes = collectUserVotes(
            [new UserVote(20, "@me:example.com", ["wings"])],
            "@me:example.com",
            "pizza",
        );

        expect(userVotes.get("@me:example.com")).toEqual(new UserVote(0, "@me:example.com", ["pizza"]));
    });

    it("ignores the local selection when there is no user ID", () => {
        const userVotes = collectUserVotes([new UserVote(20, "@me:example.com", ["wings"])], null, "pizza");

        expect(userVotes.get("@me:example.com")).toEqual(new UserVote(20, "@me:example.com", ["wings"]));
    });
});

describe("countVotes", () => {
    const userVotesFor = (...votes: UserVote[]): Map<string, UserVote> =>
        new Map(votes.map((vote) => [vote.sender, vote]));

    it("counts the votes for each answer, leaving out answers nobody voted for", () => {
        const votes = countVotes(
            userVotesFor(
                new UserVote(1, "@ab:example.com", ["pizza"]),
                new UserVote(1, "@cd:example.com", ["pizza"]),
                new UserVote(1, "@ef:example.com", ["wings"]),
            ),
            pollStart,
        );

        expect(votes).toEqual(
            new Map([
                ["pizza", 2],
                ["wings", 1],
            ]),
        );
    });

    it("ignores votes containing an answer that is not in the poll", () => {
        const votes = countVotes(
            userVotesFor(
                new UserVote(1, "@ab:example.com", ["pizza", "doesntexist"]),
                new UserVote(1, "@cd:example.com", ["wings"]),
            ),
            pollStart,
        );

        expect(votes).toEqual(new Map([["wings", 1]]));
    });

    it("only counts the first answer of a vote with more answers than the poll allows", () => {
        const votes = countVotes(userVotesFor(new UserVote(1, "@ab:example.com", ["pizza", "wings"])), pollStart);

        expect(votes).toEqual(new Map([["pizza", 1]]));
    });
});

describe("findTopAnswer", () => {
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

        expect(await runFindTopAnswer(votes)).toEqual("Poutine");
    });

    it("finds all top answers when there is a draw", async () => {
        const votes = [
            responseEvent("@uy:example.com", "italian", 14),
            responseEvent("@ab:example.com", "pizza", 17),
            responseEvent("@fa:example.com", "poutine", 18),
        ];
        expect(await runFindTopAnswer(votes)).toEqual("Italian, Pizza and Poutine");
    });

    it("is silent about the top answer if there are no votes", async () => {
        expect(await runFindTopAnswer([])).toEqual("");
    });

    it("finds no top answer for a poll event without an ID", async () => {
        const pollWithoutId = new MatrixEvent({ ...pollStartEvent.event, event_id: undefined });
        const votes = [responseEvent("@ab:example.com", "pizza", 10)];

        expect(findTopAnswer(pollWithoutId, await newVoteRelations(votes))).toEqual("");
    });

    it("finds no top answer for an event that is not a poll", async () => {
        const notAPoll = new MatrixEvent({ event_id: "$notapoll", type: "m.room.message", content: { body: "hi" } });
        const votes = [responseEvent("@ab:example.com", "pizza", 10)];

        expect(findTopAnswer(notAPoll, await newVoteRelations(votes))).toEqual("");
    });
});

describe("usePollTopAnswer", () => {
    const startEvent = makePollStartEvent("Socks or shoes?", "@alice:example.com", undefined, { roomId, ts: 1 });
    let client: MatrixClient;
    let pollEndEvent: MatrixEvent;

    const wrapper = ({ children }: PropsWithChildren): React.JSX.Element => (
        <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
    );
    const vote = (answer: string, sender: string, ts: number): MatrixEvent =>
        makePollResponseEvent(startEvent.getId()!, [answer], sender, roomId, ts);

    beforeEach(() => {
        client = stubClient();
        // Sent by the local user, so the poll accepts it as a valid end event
        pollEndEvent = makePollEndEvent(startEvent.getId()!, roomId, client.getSafeUserId(), 100);
    });

    it("returns the top answer counted from the votes cast before the poll ended", async () => {
        await setupRoomWithPollEvents(
            [startEvent],
            [
                vote("shoes", "@bob:example.com", 10),
                vote("shoes", "@carol:example.com", 10),
                vote("socks", "@dan:example.com", 10),
                // Cast after the poll ended, so should not be counted
                vote("socks", "@erin:example.com", 200),
                vote("socks", "@frank:example.com", 200),
            ],
            [pollEndEvent],
            vi.mocked(client),
        );

        const { result } = renderHook(() => usePollTopAnswer(pollEndEvent), { wrapper });

        await waitFor(() => expect(result.current).toEqual("Shoes"));
    });

    it("returns an empty string if nobody voted", async () => {
        await setupRoomWithPollEvents([startEvent], [], [pollEndEvent], vi.mocked(client));

        const { result } = renderHook(() => usePollTopAnswer(pollEndEvent), { wrapper });

        await waitFor(() => expect(result.current).toEqual(""));
    });

    it("returns undefined while the poll has not ended", async () => {
        await setupRoomWithPollEvents([startEvent], [vote("shoes", "@bob:example.com", 10)], [], vi.mocked(client));

        const { result } = renderHook(() => usePollTopAnswer(pollEndEvent), { wrapper });
        await flushPromises();

        expect(result.current).toBeUndefined();
    });

    it("returns undefined if the room is unknown", async () => {
        vi.spyOn(client, "getRoom").mockReturnValue(null);

        const { result } = renderHook(() => usePollTopAnswer(pollEndEvent), { wrapper });
        await flushPromises();

        expect(result.current).toBeUndefined();
    });

    it("counts the votes once the poll start event arrives", async () => {
        const room = new Room(roomId, client, client.getSafeUserId());
        vi.spyOn(client, "getRoom").mockReturnValue(room);

        const { result } = renderHook(() => usePollTopAnswer(pollEndEvent), { wrapper });
        expect(result.current).toBeUndefined();

        // The hook fetches the votes as soon as the poll is created, which is before
        // setupRoomWithPollEvents mocks the server response, so mock it up front
        const socksVote = vote("socks", "@bob:example.com", 10);
        vi.spyOn(client, "relations").mockResolvedValue({ events: [socksVote, pollEndEvent] });
        await setupRoomWithPollEvents([startEvent], [socksVote], [pollEndEvent], vi.mocked(client), room);

        await waitFor(() => expect(result.current).toEqual("Socks"));
    });
});
