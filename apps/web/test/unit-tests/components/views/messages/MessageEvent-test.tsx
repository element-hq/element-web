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
import MessageEvent from "../../../../../src/components/views/messages/MessageEvent";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

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

jest.mock("../../../../../src/components/views/messages/TextualBody.tsx", () => ({
    __esModule: true,
    default: () => <div data-testid="textual-body" />,
}));

describe("MessageEvent", () => {
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    const renderMessageEvent = (): RenderResult => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <MessageEvent mxEvent={event} permalinkCreator={new RoomPermalinkCreator(room)} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(SettingsStore, "getValue");
        jest.spyOn(SettingsStore, "watchSetting");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    it("renders the shared redacted body for redacted events", () => {
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);
        event = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:example.com",
            room: room.roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Secret",
            },
            unsigned: {
                redacted_because: {
                    sender: "@moderator:example.com",
                    origin_server_ts: Date.UTC(2022, 10, 17, 15, 58, 32),
                },
            },
        });
        jest.spyOn(event, "isRedacted").mockReturnValue(true);

        const result = renderMessageEvent();

        expect(result.getByText("Message deleted by Moderator")).toBeInTheDocument();
        expect(result.container.querySelector(".mx_RedactedBody")).not.toBeNull();
        expect(result.queryByTestId("textual-body")).toBeNull();
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
            result.getByTestId("textual-body");
        });

        it("should render a TextualBody and a FileBody for mismatched extension", () => {
            event = createEvent("image/webp", "image.exe", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("file-body");
            result.getByTestId("textual-body");
        });

        it("should render a TextualBody and an VideoBody", () => {
            event = createEvent("video/mp4", "video.mp4", MsgType.Video);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("video-body");
            result.getByTestId("textual-body");
        });

        it("should render a TextualBody and a FileBody for non-video mimetype", () => {
            event = createEvent("application/octet-stream", "video.mp4", MsgType.Video);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("file-body");
            result.getByTestId("textual-body");
        });
    });
});
