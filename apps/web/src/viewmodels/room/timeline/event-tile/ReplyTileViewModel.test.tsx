/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { EventType, type MatrixClient, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { stubClient } from "test-utils";

import { VideoBodyFactory } from "../../../../components/views/messages/MBodyFactory";
import { renderReplyTile } from "../../../../events/EventTileFactory";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { ReplyTileViewModel } from "./ReplyTileViewModel";

vi.mock("../../../../events/EventTileFactory", () => ({
    renderReplyTile: vi.fn(() => null),
}));

vi.mock("../../../../utils/EventRenderingUtils", () => ({
    getEventDisplayInfo: vi.fn(),
}));

describe("ReplyTileViewModel", () => {
    let cli: MatrixClient;

    const createEvent = ({
        msgtype = MsgType.Text,
        body = "Reply body",
        content = {},
    }: {
        msgtype?: MsgType;
        body?: string;
        content?: Record<string, unknown>;
    } = {}): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:server",
            event_id: "$reply",
            sender: "@alice:server",
            content: {
                body,
                msgtype,
                ...content,
            },
        });

    beforeEach(() => {
        cli = stubClient();
        vi.clearAllMocks();
        vi.mocked(getEventDisplayInfo).mockReturnValue({
            hasRenderer: true,
            isInfoMessage: false,
            isBubbleMessage: false,
            isLeftAlignedBubbleMessage: false,
            noBubbleEvent: false,
            isSeeingThroughMessageHiddenForModeration: false,
            isAlignedBetweenBubbles: false,
        });
        vi.mocked(renderReplyTile).mockReturnValue(<span>Reply body</span>);
    });

    it("renders video replies with the video body override", () => {
        const mxEvent = createEvent({
            msgtype: MsgType.Video,
            body: "video.mp4",
            content: {
                url: "mxc://server/video",
                info: {
                    mimetype: "video/mp4",
                    w: 640,
                    h: 360,
                },
            },
        });

        const vm = new ReplyTileViewModel({ mxEvent, cli });

        expect(renderReplyTile).toHaveBeenCalledWith(
            expect.objectContaining({
                mxEvent,
                showUrlPreview: false,
                showHiddenEvents: false,
                maxImageHeight: 96,
                overrideBodyTypes: expect.objectContaining({
                    [MsgType.Video]: VideoBodyFactory,
                }),
            }),
            false,
        );
        expect(vm.getSnapshot()).toMatchObject({
            href: "#",
            inline: false,
            info: false,
        });
    });

    it("marks emote replies as inline and omits the sender profile", () => {
        const vm = new ReplyTileViewModel({
            mxEvent: createEvent({ msgtype: MsgType.Emote, body: "waves" }),
            cli,
        });

        expect(vm.getSnapshot().inline).toBe(true);
        expect(vm.getSnapshot().sender?.profileViewModel).toBeUndefined();
    });
});
