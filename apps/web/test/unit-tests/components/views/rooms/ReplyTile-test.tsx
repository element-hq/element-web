/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";

import ReplyTile from "../../../../../src/components/views/rooms/ReplyTile";
import { renderReplyTile } from "../../../../../src/events/EventTileFactory";
import { VideoBodyFactory } from "../../../../../src/components/views/messages/MBodyFactory";
import { mkEvent, stubClient } from "../../../../test-utils";

jest.mock("../../../../../src/events/EventTileFactory", () => {
    const actual = jest.requireActual("../../../../../src/events/EventTileFactory");
    return {
        ...actual,
        renderReplyTile: jest.fn(() => <span>Reply body</span>),
    };
});

describe("ReplyTile", () => {
    beforeEach(() => {
        stubClient();
        jest.mocked(renderReplyTile)
            .mockClear()
            .mockReturnValue(<span>Reply body</span>);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders video replies with the video body without legacy ReplyTile classes", () => {
        const mxEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:server",
            room: "!room:server",
            id: "$video",
            content: {
                body: "video.mp4",
                msgtype: MsgType.Video,
                url: "mxc://server/video",
                info: {
                    mimetype: "video/mp4",
                    w: 640,
                    h: 360,
                },
            },
        });

        const { container, getByTestId, getByText } = render(<ReplyTile mxEvent={mxEvent} />);

        expect(renderReplyTile).toHaveBeenCalledWith(
            expect.objectContaining({
                overrideBodyTypes: expect.objectContaining({
                    [MsgType.Video]: VideoBodyFactory,
                }),
            }),
            false,
        );
        expect(getByTestId("reply-tile")).toBeInTheDocument();
        expect(getByTestId("reply-tile-sender")).toBeInTheDocument();
        expect(getByText("Reply body")).toBeInTheDocument();
        expect(container.querySelector(".mx_ReplyTile")).not.toBeInTheDocument();
        expect(container.querySelector(".mx_ReplyTile_sender")).not.toBeInTheDocument();
    });

    it("does not emit legacy inline classes for emote replies", () => {
        const mxEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:server",
            room: "!room:server",
            id: "$emote",
            content: {
                body: "waves",
                msgtype: MsgType.Emote,
            },
        });

        const { container, getByTestId } = render(<ReplyTile mxEvent={mxEvent} />);

        expect(getByTestId("reply-tile")).toBeInTheDocument();
        expect(container.querySelector(".mx_ReplyTile_inline")).not.toBeInTheDocument();
    });
});
