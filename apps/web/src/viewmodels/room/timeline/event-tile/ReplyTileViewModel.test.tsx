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

import { FileBodyFactory, VideoBodyFactory } from "../../../../components/views/messages/MBodyFactory";
import { type IBodyProps } from "../../../../components/views/messages/IBodyProps";
import MImageReplyBody from "../../../../components/views/messages/MImageReplyBody";
import MVoiceMessageBody from "../../../../components/views/messages/MVoiceMessageBody";
import { renderReplyTile } from "../../../../events/EventTileFactory";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { ReplyTileViewModel } from "./ReplyTileViewModel";

type ReplyTileRenderProps = Parameters<typeof renderReplyTile>[0];
type ReplyTileBodyOverrides = NonNullable<ReplyTileRenderProps["overrideBodyTypes"]>;
type ReplyTileEventOverrides = NonNullable<ReplyTileRenderProps["overrideEventTypes"]>;

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

    const getReplyTileProps = (): ReplyTileRenderProps => {
        const calls = vi.mocked(renderReplyTile).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        return calls[calls.length - 1][0];
    };

    const getReplyTileOverrides = (): {
        overrideBodyTypes: ReplyTileBodyOverrides;
        overrideEventTypes: ReplyTileEventOverrides;
    } => {
        const { overrideBodyTypes, overrideEventTypes } = getReplyTileProps();
        expect(overrideBodyTypes).toBeDefined();
        expect(overrideEventTypes).toBeDefined();
        return {
            overrideBodyTypes: overrideBodyTypes!,
            overrideEventTypes: overrideEventTypes!,
        };
    };

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

    it("renders regular text replies with the default reply body", () => {
        const mxEvent = createEvent();

        const vm = new ReplyTileViewModel({ mxEvent, cli });

        const replyTileProps = getReplyTileProps();
        expect(replyTileProps.mxEvent).toBe(mxEvent);
        expect(Reflect.has(getReplyTileOverrides().overrideBodyTypes, MsgType.Text)).toBe(false);
        expect(vm.getSnapshot()).toMatchObject({
            href: "#",
            inline: false,
            info: false,
            body: <span>Reply body</span>,
        });
        expect(vm.getSnapshot().sender).toBeDefined();
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

    it("renders media replies with reply-specific body overrides", () => {
        const audioEvent = createEvent({ msgtype: MsgType.Audio, body: "audio.ogg" });

        new ReplyTileViewModel({ mxEvent: audioEvent, cli });

        const { overrideBodyTypes, overrideEventTypes } = getReplyTileOverrides();
        expect(overrideBodyTypes).toMatchObject({
            [MsgType.Image]: MImageReplyBody,
            [MsgType.Video]: VideoBodyFactory,
        });
        expect(overrideEventTypes).toMatchObject({
            [EventType.Sticker]: MImageReplyBody,
        });

        const audioOverride = overrideBodyTypes[MsgType.Audio];
        expect(audioOverride).not.toBe(MVoiceMessageBody);

        const audioBody = (audioOverride as (props: IBodyProps) => React.ReactNode)({
            mxEvent: audioEvent,
        } as IBodyProps);
        if (!React.isValidElement(audioBody)) {
            throw new Error("Expected audio override to render a file body element");
        }
        expect(audioBody.type).toBe(FileBodyFactory);
    });

    it("renders voice replies with the voice body override", () => {
        const voiceEvent = createEvent({
            msgtype: MsgType.Audio,
            body: "voice.ogg",
            content: {
                "org.matrix.msc3245.voice": true,
            },
        });

        new ReplyTileViewModel({ mxEvent: voiceEvent, cli });

        expect(getReplyTileOverrides().overrideBodyTypes[MsgType.Audio]).toBe(MVoiceMessageBody);
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
