/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult } from "jest-matrix-react";
import { type MatrixClient, type MatrixEvent, EventType, type Room, MsgType } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/jest";
import fs from "fs";
import path from "path";

import SettingsStore from "../../../../../src/settings/SettingsStore";
import { mkEvent, mkRoom, stubClient } from "../../../../test-utils";
import { getRoomContext } from "../../../../test-utils/room";
import MessageEvent from "../../../../../src/components/views/messages/MessageEvent";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import RoomContext from "../../../../../src/contexts/RoomContext";

jest.mock("../../../../../src/components/views/messages/UnknownBody", () => ({
    __esModule: true,
    default: () => <div data-testid="unknown-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MImageBody", () => ({
    __esModule: true,
    default: () => <div data-testid="image-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MVideoBody", () => ({
    __esModule: true,
    default: () => <div data-testid="video-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MBodyFactory", () => ({
    __esModule: true,
    FileBodyViewFactory: () => <div data-testid="file-body" />,
    renderMBody: () => <div data-testid="file-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MImageReplyBody", () => ({
    __esModule: true,
    default: () => <div data-testid="image-reply-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MStickerBody", () => ({
    __esModule: true,
    default: () => <div data-testid="sticker-body" />,
}));

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    useMediaVisible: () => [true, jest.fn()],
}));

describe("MessageEvent", () => {
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    const renderMessageEvent = (): RenderResult => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={getRoomContext(room, { room })}>
                    <MessageEvent mxEvent={event} permalinkCreator={new RoomPermalinkCreator(room)} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(SettingsStore, "getValue");
        jest.spyOn(SettingsStore, "watchSetting");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    describe("when an image with a caption is sent", () => {
        let result: RenderResult;

        function createEvent(mimetype: string, filename: string, msgtype: string) {
            return mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: client.getUserId()!,
                room: room.roomId,
                content: {
                    body: "caption for a test image",
                    format: "org.matrix.custom.html",
                    formatted_body: "<strong>caption for a test image</strong>",
                    msgtype: msgtype,
                    filename: filename,
                    info: {
                        w: 40,
                        h: 50,
                        mimetype: mimetype,
                    },
                    url: "mxc://server/image",
                },
            });
        }

        function mockMedia() {
            fetchMock.getOnce("https://server/_matrix/media/v3/download/server/image", {
                body: fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "images", "animated-logo.webp")),
            });
        }

        it("should render a TextualBody and an ImageBody", () => {
            event = createEvent("image/webp", "image.webp", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("image-body");
            expect(result.container.querySelector(".mx_MTextBody")).toHaveTextContent("caption for a test image");
        });

        it("should render a TextualBody and a FileBody for mismatched extension", () => {
            event = createEvent("image/webp", "image.exe", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("file-body");
            expect(result.container.querySelector(".mx_MTextBody")).toHaveTextContent("caption for a test image");
        });

        it("should render a TextualBody and an VideoBody", () => {
            event = createEvent("video/mp4", "video.mp4", MsgType.Video);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("video-body");
            expect(result.container.querySelector(".mx_MTextBody")).toHaveTextContent("caption for a test image");
        });

        it("should render a TextualBody and a FileBody for non-video mimetype", () => {
            event = createEvent("application/octet-stream", "video.mp4", MsgType.Video);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("file-body");
            expect(result.container.querySelector(".mx_MTextBody")).toHaveTextContent("caption for a test image");
        });
    });
});
