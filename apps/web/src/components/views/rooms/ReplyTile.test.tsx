/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "test-utils-rtl";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient } from "test-utils";

import ReplyTile from "./ReplyTile";
import { renderReplyTile } from "../../../events/EventTileFactory";
import { VideoBodyFactory } from "../messages/MBodyFactory";

vi.mock("../../../events/EventTileFactory", async () => {
    const actual = await vi.importActual("../../../events/EventTileFactory");
    return {
        ...actual,
        renderReplyTile: vi.fn(() => null),
    };
});
vi.mock("../messages/SenderProfile", () => ({ default: vi.fn(() => null) }));
vi.mock("../avatars/MemberAvatar", () => ({ default: vi.fn(() => null) }));

describe("ReplyTile", () => {
    beforeEach(() => {
        stubClient();
        vi.mocked(renderReplyTile).mockClear().mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
