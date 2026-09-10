/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import { describe, it, expect, vi } from "vitest";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient, withClientContextRenderOptions } from "test-utils";

import ReplyChain from "./ReplyChain";

describe("ReplyChain", () => {
    it("should call setQuoteExpanded if chain is longer than 2 lines", async () => {
        // Jest/JSDOM won't set clientHeight/scrollHeight for us so we have to synthesise it
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(150);

        const cli = stubClient();
        const { room_id: roomId } = await cli.createRoom({});
        const room = cli.getRoom(roomId)!;

        const targetEv = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getUserId()!,
            room: roomId,
            id: "$event1",
            content: {
                body: "A\nB\nC",
                msgtype: "m.text",
            },
        });
        vi.spyOn(room, "findEventById").mockReturnValue(targetEv);

        const parentEv = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getUserId()!,
            room: roomId,
            id: "$event2",
            content: {
                "body": "Reply",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: "$event1",
                    },
                },
            },
        });
        const setQuoteExpanded = vi.fn();
        const { asFragment } = render(
            <ReplyChain parentEv={parentEv} setQuoteExpanded={setQuoteExpanded} />,
            withClientContextRenderOptions(cli),
        );

        await waitFor(() => expect(setQuoteExpanded).toHaveBeenCalledWith(false));
        expect(asFragment()).toMatchSnapshot();
    });

    it("keeps long edited reply quotes collapsible", async () => {
        // Jest/JSDOM won't set clientHeight/scrollHeight for us so we have to synthesise it
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(150);

        const cli = stubClient();
        const { room_id: roomId } = await cli.createRoom({});
        const room = cli.getRoom(roomId)!;
        const longBody = Array.from({ length: 80 }, (_, index) => `word${index}`).join(" ");
        const editedLongBody = `${longBody} edited`;

        const targetEv = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getUserId()!,
            room: roomId,
            id: "$event1",
            content: {
                body: longBody,
                msgtype: "m.text",
            },
        });
        const editEv = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getUserId()!,
            room: roomId,
            id: "$event1-edit",
            content: {
                "body": `* ${editedLongBody}`,
                "msgtype": "m.text",
                "m.new_content": {
                    body: editedLongBody,
                    msgtype: "m.text",
                },
            },
        });
        vi.spyOn(targetEv, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        targetEv.makeReplaced(editEv);
        vi.spyOn(room, "findEventById").mockReturnValue(targetEv);

        const parentEv = mkEvent({
            event: true,
            type: "m.room.message",
            user: cli.getUserId()!,
            room: roomId,
            id: "$event2",
            content: {
                "body": "Reply",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: "$event1",
                    },
                },
            },
        });
        const setQuoteExpanded = vi.fn();
        const { container } = render(
            <ReplyChain parentEv={parentEv} setQuoteExpanded={setQuoteExpanded} />,
            withClientContextRenderOptions(cli),
        );

        await waitFor(() => expect(setQuoteExpanded).toHaveBeenCalledWith(false));
        await waitFor(() => expect(container).toHaveTextContent(editedLongBody));

        const replyTile = container.querySelector(".mx_ReplyTile");
        expect(replyTile).not.toBeNull();
        const annotationWrapper = replyTile!.querySelector("[data-textual-body-annotation-wrapper]");
        expect(annotationWrapper).not.toBeNull();
        expect(annotationWrapper).toContainElement(replyTile!.querySelector(".mx_EventTile_body"));
        expect(annotationWrapper).toContainElement(replyTile!.querySelector("[data-textual-body-edited-marker]"));
    });

    describe("compact preview", () => {
        /** A message replying to `targetId`, with `target` resolvable in the room. */
        const setUp = async (target: MatrixEvent | null): Promise<{ cli: MatrixClient; parentEv: MatrixEvent }> => {
            const cli = stubClient();
            const { room_id: roomId } = await cli.createRoom({});
            const room = cli.getRoom(roomId)!;
            vi.spyOn(room, "findEventById").mockImplementation((id) =>
                target && id === target.getId() ? target : undefined,
            );

            const parentEv = mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$reply",
                content: {
                    "body": "Reply",
                    "msgtype": "m.text",
                    "m.relates_to": { "m.in_reply_to": { event_id: "$quoted" } },
                },
            });
            return { cli, parentEv };
        };

        const mkQuoted = (cli: MatrixClient, roomId: string): MatrixEvent =>
            mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$quoted",
                content: { body: "Quoted", msgtype: "m.text" },
            });

        it("shows the quoted message immediately when the room already has it", async () => {
            const cli = stubClient();
            const { room_id: roomId } = await cli.createRoom({});
            const room = cli.getRoom(roomId)!;
            const quoted = mkQuoted(cli, roomId);
            vi.spyOn(room, "findEventById").mockReturnValue(quoted);
            const parentEv = mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$reply",
                content: {
                    "body": "Reply",
                    "msgtype": "m.text",
                    "m.relates_to": { "m.in_reply_to": { event_id: "$quoted" } },
                },
            });

            const { container } = render(
                <ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} compactPreview={true} />,
                withClientContextRenderOptions(cli),
            );

            // Drawn on the first render, with no loading state in between.
            expect(container.querySelector(".mx_ReplyTile")).not.toBeNull();
            expect(container.querySelector(".mx_ReplyChain_placeholder")).toBeNull();
        });

        it("holds a fixed-height skeleton while the quoted message is fetched", async () => {
            const { cli, parentEv } = await setUp(null);
            // Never settles, so the chain stays in its loading state.
            vi.spyOn(cli, "getEventTimeline").mockReturnValue(new Promise(() => {}) as never);

            const { container } = render(
                <ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} compactPreview={true} />,
                withClientContextRenderOptions(cli),
            );

            const placeholder = container.querySelector(".mx_ReplyChain_placeholder");
            expect(placeholder).not.toBeNull();
            // Two rows: one standing in for the sender, one for the message.
            expect(placeholder!.querySelectorAll(".mx_ReplyChain_placeholderRow")).toHaveLength(2);
        });

        it("uses a spinner rather than the skeleton outside the new timeline", async () => {
            const { cli, parentEv } = await setUp(null);
            vi.spyOn(cli, "getEventTimeline").mockReturnValue(new Promise(() => {}) as never);

            const { container } = render(
                <ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} />,
                withClientContextRenderOptions(cli),
            );

            expect(container.querySelector(".mx_ReplyChain_placeholder")).toBeNull();
            expect(container.querySelector(".mx_Spinner")).not.toBeNull();
        });

        it("reports an error when the quoted message cannot be fetched", async () => {
            const { cli, parentEv } = await setUp(null);
            vi.spyOn(cli, "getEventTimeline").mockRejectedValue(new Error("no such event"));

            const { container } = render(
                <ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} compactPreview={true} />,
                withClientContextRenderOptions(cli),
            );

            await waitFor(() => expect(container.querySelector(".mx_ReplyChain_error")).not.toBeNull());
        });

        it("still shows who a nested reply was answering", async () => {
            const cli = stubClient();
            const { room_id: roomId } = await cli.createRoom({});
            const room = cli.getRoom(roomId)!;
            // The quoted message is itself a reply, so a header names whoever it answered.
            const grandparent = mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$grandparent",
                content: { body: "First", msgtype: "m.text" },
            });
            const quoted = mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$quoted",
                content: {
                    "body": "Quoted",
                    "msgtype": "m.text",
                    "m.relates_to": { "m.in_reply_to": { event_id: "$grandparent" } },
                },
            });
            vi.spyOn(room, "findEventById").mockImplementation((id) =>
                id === "$quoted" ? quoted : id === "$grandparent" ? grandparent : undefined,
            );
            const parentEv = mkEvent({
                event: true,
                type: "m.room.message",
                user: cli.getUserId()!,
                room: roomId,
                id: "$reply",
                content: {
                    "body": "Reply",
                    "msgtype": "m.text",
                    "m.relates_to": { "m.in_reply_to": { event_id: "$quoted" } },
                },
            });

            render(
                <ReplyChain parentEv={parentEv} setQuoteExpanded={vi.fn()} compactPreview={true} />,
                withClientContextRenderOptions(cli),
            );

            await waitFor(() => expect(screen.getByText("In reply to", { exact: false })).toBeInTheDocument());
        });
    });
});
