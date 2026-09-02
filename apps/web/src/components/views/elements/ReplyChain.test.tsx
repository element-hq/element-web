/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { type MatrixClient, type MatrixEvent, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import ReplyChain from "./ReplyChain";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { mkMessage, stubClient } from "../../../../test/test-utils";

// The quoted message is drawn by ReplyTile, which pulls in the whole tile tree;
// these tests are about which of the three states the chain chooses.
vi.mock("../rooms/ReplyTile", () => ({
    default: ({ mxEvent }: { mxEvent: MatrixEvent }) => <div data-testid="reply-tile">{mxEvent.getId()}</div>,
}));

// The header's user pill reaches for profile stores this test has no need of.
vi.mock("./Pill", () => ({
    Pill: ({ url }: { url: string }) => <span data-testid="user-pill">{url}</span>,
}));

describe("<ReplyChain />", () => {
    const ROOM_ID = "!room:example.org";
    const USER_ID = "@alice:example.org";
    let client: MatrixClient;
    let room: Room;

    /** A message that replies to `target`. */
    const mkReplyTo = (id: string, targetId: string): MatrixEvent => {
        const event = mkMessage({ room: ROOM_ID, user: USER_ID, msg: "a reply", event: true, id });
        event.getContent()["m.relates_to"] = { "m.in_reply_to": { event_id: targetId } };
        return event;
    };

    const renderChain = (parentEv: MatrixEvent, compactPreview?: boolean) =>
        render(<ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} compactPreview={compactPreview} />);

    beforeEach(() => {
        client = stubClient();
        room = new Room(ROOM_ID, client, USER_ID, { pendingEventOrdering: PendingEventOrdering.Detached });
        vi.spyOn(client, "getRoom").mockReturnValue(room);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
    });

    it("shows the quoted message straight away when the room already has it", () => {
        const quoted = mkMessage({ room: ROOM_ID, user: USER_ID, msg: "quoted", event: true, id: "$quoted" });
        room.getUnfilteredTimelineSet().addLiveEvent(quoted, { addToState: false });
        const reply = mkReplyTo("$reply", "$quoted");

        renderChain(reply, true);

        // Present on the very first render, with no loading state in between.
        expect(screen.getByTestId("reply-tile")).toHaveTextContent("$quoted");
        expect(document.querySelector(".mx_ReplyChain_placeholder")).toBeNull();
    });

    it("holds a fixed-height skeleton while the quoted message is fetched", () => {
        const reply = mkReplyTo("$reply", "$missing");
        // Never resolves, so the chain stays in its loading state.
        vi.spyOn(client, "getEventTimeline").mockReturnValue(new Promise(() => {}) as never);

        renderChain(reply, true);

        const placeholder = document.querySelector(".mx_ReplyChain_placeholder");
        expect(placeholder).not.toBeNull();
        // Two rows: one standing in for the sender, one for the message.
        expect(placeholder!.querySelectorAll(".mx_ReplyChain_placeholderRow")).toHaveLength(2);
    });

    it("uses a spinner rather than the skeleton outside the new timeline", () => {
        const reply = mkReplyTo("$reply", "$missing");
        vi.spyOn(client, "getEventTimeline").mockReturnValue(new Promise(() => {}) as never);

        renderChain(reply);

        expect(document.querySelector(".mx_ReplyChain_placeholder")).toBeNull();
        expect(document.querySelector(".mx_Spinner")).not.toBeNull();
    });

    it("reports an error when the quoted message cannot be fetched", async () => {
        const reply = mkReplyTo("$reply", "$missing");
        vi.spyOn(client, "getEventTimeline").mockRejectedValue(new Error("no such event"));

        renderChain(reply, true);

        await waitFor(() => expect(document.querySelector(".mx_ReplyChain_error")).not.toBeNull());
    });

    it("fetches the header event so nested replies still show who was replied to", async () => {
        // The quoted message is itself a reply, so a header above the preview names
        // whoever it answered.
        const grandparent = mkMessage({ room: ROOM_ID, user: USER_ID, msg: "first", event: true, id: "$grandparent" });
        const quoted = mkReplyTo("$quoted", "$grandparent");
        room.getUnfilteredTimelineSet().addLiveEvent(grandparent, { addToState: false });
        room.getUnfilteredTimelineSet().addLiveEvent(quoted, { addToState: false });
        const reply = mkReplyTo("$reply", "$quoted");

        renderChain(reply, true);

        await waitFor(() => expect(screen.getByText("In reply to", { exact: false })).toBeInTheDocument());
    });
});
