/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "jest-matrix-react";

import ReplyChain from "../../../../../src/components/views/elements/ReplyChain.tsx";
import { mkEvent, stubClient, withClientContextRenderOptions } from "../../../../test-utils";

describe("ReplyChain", () => {
    it("should call setQuoteExpanded if chain is longer than 2 lines", async () => {
        // Jest/JSDOM won't set clientHeight/scrollHeight for us so we have to synthesise it
        jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
        jest.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(150);

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
        jest.spyOn(room, "findEventById").mockReturnValue(targetEv);

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
        const setQuoteExpanded = jest.fn();
        const { asFragment } = render(
            <ReplyChain parentEv={parentEv} setQuoteExpanded={setQuoteExpanded} />,
            withClientContextRenderOptions(cli),
        );

        await waitFor(() => expect(setQuoteExpanded).toHaveBeenCalledWith(false));
        expect(asFragment()).toMatchSnapshot();
    });

    it("keeps long edited reply quotes collapsible", async () => {
        // Jest/JSDOM won't set clientHeight/scrollHeight for us so we have to synthesise it
        jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
        jest.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(150);

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
        jest.spyOn(targetEv, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        targetEv.makeReplaced(editEv);
        jest.spyOn(room, "findEventById").mockReturnValue(targetEv);

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
        const setQuoteExpanded = jest.fn();
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
});
