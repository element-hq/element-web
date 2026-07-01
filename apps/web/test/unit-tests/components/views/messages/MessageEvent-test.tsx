/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult } from "jest-matrix-react";
import { type MatrixClient, type MatrixEvent, EventType, type Room, MsgType } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/jest";
import fs from "fs";
import path from "path";

import SettingsStore from "../../../../../src/settings/SettingsStore";
import { mkEvent, mkRoom, stubClient } from "../../../../test-utils";
import MessageEvent from "../../../../../src/components/views/messages/MessageEvent";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { Mjolnir } from "../../../../../src/mjolnir/Mjolnir";

jest.mock("../../../../../src/components/views/messages/MBodyFactory", () => ({
    __esModule: true,
    DecryptionFailureBodyFactory: () => <div data-testid="decryption-failure-body" />,
    FileBodyFactory: () => <div data-testid="file-body" />,
    ImageBodyFactory: () => <div data-testid="image-body" />,
    RedactedBodyFactory: () => <div className="mx_RedactedBody">Message deleted by Moderator</div>,
    VideoBodyFactory: () => <video data-testid="video-body" />,
    renderMBody: () => <div data-testid="file-body" />,
}));

jest.mock("../../../../../src/components/views/messages/TextualBodyFactory", () => ({
    __esModule: true,
    TextualBodyFactory: () => <div data-testid="textual-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MImageReplyBody", () => ({
    __esModule: true,
    default: () => <div data-testid="image-reply-body" />,
}));

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: () => [true, jest.fn()],
}));

jest.mock("../../../../../src/components/views/messages/MStickerBody", () => ({
    __esModule: true,
    default: () => <div data-testid="sticker-body" />,
}));

describe("MessageEvent", () => {
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    const makeRedactedBecauseEvent = ({ sender, originServerTs }: { sender: string; originServerTs: number }) => ({
        content: {},
        event_id: "$redaction:example.com",
        origin_server_ts: originServerTs,
        redacts: "$message:example.com",
        room_id: room.roomId,
        sender,
        type: EventType.RoomRedaction,
        unsigned: {},
    });

    const renderMessageEvent = (): RenderResult => {
        return render(
            <MatrixClientContext.Provider value={client}>
                <MessageEvent mxEvent={event} permalinkCreator={new RoomPermalinkCreator(room)} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        localStorage.clear();
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(SettingsStore, "getValue");
        jest.spyOn(SettingsStore, "watchSetting");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
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
                redacted_because: makeRedactedBecauseEvent({
                    sender: "@moderator:example.com",
                    originServerTs: Date.UTC(2022, 10, 17, 15, 58, 32),
                }),
            },
        });
        jest.spyOn(event, "isRedacted").mockReturnValue(true);

        const result = renderMessageEvent();

        expect(result.getByText("Message deleted by Moderator")).toBeInTheDocument();
        expect(result.container.querySelector(".mx_RedactedBody")).not.toBeNull();
        expect(result.queryByTestId("textual-body")).toBeNull();
    });

    it("renders the shared Mjolnir body for banned senders", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === "feature_mjolnir");
        jest.spyOn(Mjolnir, "sharedInstance").mockReturnValue({
            isUserBanned: jest.fn().mockReturnValue(true),
            isServerBanned: jest.fn().mockReturnValue(false),
        } as unknown as Mjolnir);
        event = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            id: "$hidden:example.com",
            user: "@alice:example.com",
            room: room.roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Hidden",
            },
        });

        const result = renderMessageEvent();

        expect(result.getByText(/You have ignored this user, so their message is hidden\./)).toBeInTheDocument();
        const allowButton = result.getByRole("button", { name: "Show anyways." });

        fireEvent.click(allowButton);

        expect(localStorage.getItem(`mx_mjolnir_render_${room.roomId}__$hidden:example.com`)).toBe("true");
    });

    it("renders the shared unknown body for unsupported message types", () => {
        event = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:example.com",
            room: room.roomId,
            content: {
                msgtype: "org.example.unsupported",
                body: "Unsupported message body",
            },
        });

        const result = renderMessageEvent();

        expect(result.getByText("Unsupported message body")).toBeInTheDocument();
        expect(result.container.querySelector(".mx_UnknownBody")).not.toBeNull();
        expect(result.queryByTestId("textual-body")).toBeNull();
    });

    describe("when an image with a caption is sent", () => {
        let result: RenderResult;

        // HEIC is only rendered as an image where the platform can decode it (desktop main process exposes
        // window.electron.decodeHeic); simulate that being available for these tests.
        beforeEach(() => {
            (window as any).electron = { decodeHeic: jest.fn() };
        });
        afterEach(() => {
            delete (window as any).electron;
        });

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

        it("should render an ImageBody for HEIC even when the filename has no usable extension", () => {
            // Regression: HEIC images are decoded to JPEG at display time and must reach the image
            // renderer. The generic extension/mimetype validation used to downgrade them to a file
            // attachment when `mime` couldn't classify the filename; the content mimetype short-circuit
            // must keep them as images. Use an extension-less filename so this fails without the fix.
            event = createEvent("image/heic", "IMG_0001", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("image-body");
            result.getByTestId("textual-body");
        });

        it("should render an ImageBody for HEIC sent as an m.file (other clients downgrade it)", () => {
            // Regression: clients that can't thumbnail HEIC send it as an m.file. The viewer must still
            // route it to the image renderer (which decodes to JPEG) rather than show a file-download chip.
            event = createEvent("image/heic", "IMG_0001.heic", MsgType.File);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("image-body");
            result.getByTestId("textual-body");
        });

        it("should render an ImageBody for an m.file HEIC detected by extension alone (no mimetype)", () => {
            // Some senders omit or mangle the mimetype; the .heic/.heif extension must be enough.
            event = createEvent("", "IMG_0001.HEIC", MsgType.File);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("image-body");
            result.getByTestId("textual-body");
        });

        it("should render a FileBody for HEIC when the platform has no OS decoder (graceful degradation)", () => {
            // With no window.electron.decodeHeic (e.g. Element Web, or desktop without OS HEIC support),
            // Element bundles no decoder, so HEIC must fall back to a file attachment rather than a broken
            // image. The HEIC mimetype with an image filename would otherwise render as an image body, so
            // this exercises the no-decoder downgrade gate.
            delete (window as any).electron;
            event = createEvent("image/heic", "photo.jpg", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            result.getByTestId("file-body");
            expect(result.queryByTestId("image-body")).toBeNull();
        });

        it("should not clobber an overridden body for HEIC (e.g. a compact reply body)", () => {
            // The HEIC rescue must only rescue events that would otherwise render as the file body.
            // An overridden body (like ReplyTile's MImageReplyBody) must be left alone.
            event = createEvent("image/heic", "IMG_0001.heic", MsgType.Image);
            const result = render(
                <MatrixClientContext.Provider value={client}>
                    <MessageEvent
                        mxEvent={event}
                        permalinkCreator={new RoomPermalinkCreator(room)}
                        overrideBodyTypes={{ [MsgType.Image]: () => <div data-testid="reply-body" /> }}
                    />
                </MatrixClientContext.Provider>,
            );
            mockMedia();
            result.getByTestId("reply-body");
            expect(result.queryByTestId("image-body")).toBeNull();
        });

        it("should render a TextualBody and a video element", () => {
            event = createEvent("video/mp4", "video.mp4", MsgType.Video);
            result = renderMessageEvent();
            mockMedia();
            expect(result.container.querySelector("video")).not.toBeNull();
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
