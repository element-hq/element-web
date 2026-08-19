/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "jest-matrix-react";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";

import ReplyPreview from "../../../../../src/components/views/rooms/ReplyPreview";
import { mkEvent, stubClient, withClientContextRenderOptions } from "../../../../test-utils";

describe("ReplyPreview", () => {
    beforeEach(() => {
        stubClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders its reply tile without legacy ReplyTile classes", async () => {
        const cli = stubClient();
        const { room_id: roomId } = await cli.createRoom({});
        const replyToEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:server",
            room: roomId,
            id: "$reply",
            content: {
                body: "Reply body",
                msgtype: MsgType.Text,
            },
        });

        const { container, getByTestId } = render(
            <ReplyPreview replyToEvent={replyToEvent} />,
            withClientContextRenderOptions(cli),
        );

        await waitFor(() => expect(getByTestId("reply-tile-body")).toHaveTextContent("Reply body"));
        expect(getByTestId("reply-tile")).toBeInTheDocument();
        expect(container.querySelector(".mx_ReplyTile")).not.toBeInTheDocument();
        expect(container.querySelector(".mx_ReplyTile_sender")).not.toBeInTheDocument();
    });
});
