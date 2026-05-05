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
        renderReplyTile: jest.fn(() => null),
    };
});
jest.mock("../../../../../src/components/views/messages/SenderProfile", () => jest.fn(() => null));
jest.mock("../../../../../src/components/views/avatars/MemberAvatar", () => jest.fn(() => null));

describe("ReplyTile", () => {
    beforeEach(() => {
        stubClient();
        jest.mocked(renderReplyTile).mockClear().mockReturnValue(null);
    });

    it("renders video replies with the video body", () => {
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

        render(<ReplyTile mxEvent={mxEvent} />);

        expect(renderReplyTile).toHaveBeenCalledWith(
            expect.objectContaining({
                overrideBodyTypes: expect.objectContaining({
                    [MsgType.Video]: VideoBodyFactory,
                }),
            }),
            false,
        );
    });
});
