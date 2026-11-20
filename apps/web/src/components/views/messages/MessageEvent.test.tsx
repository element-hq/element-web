/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, type RenderResult } from "test-utils-rtl";
import { type MatrixClient, type MatrixEvent, EventType, type Room, MsgType } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { mkEvent, mkRoom, stubClient } from "test-utils";

import SettingsStore from "../../../settings/SettingsStore";
import MessageEvent from "./MessageEvent";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";

vi.mock("./MBodyFactory", () => ({
    __esModule: true,
    DecryptionFailureBodyFactory: () => <div data-testid="decryption-failure-body" />,
    FileBodyFactory: () => <div data-testid="file-body" />,
    GalleryBodyFactory: () => <div data-testid="gallery-body" />,
    ImageBodyFactory: () => <div data-testid="image-body" />,
    RedactedBodyFactory: () => <div className="mx_RedactedBody">Message deleted by Moderator</div>,
    VideoBodyFactory: () => <video data-testid="video-body" />,
    renderMBody: () => <div data-testid="file-body" />,
}));

vi.mock("./TextualBodyFactory", () => ({
    __esModule: true,
    // Hosts the editor while the message is being edited
    TextualBodyFactory: ({ editState }: { editState?: unknown }) => (
        <div data-testid="textual-body" data-editing={editState ? "true" : "false"} />
    ),
}));

vi.mock("./MImageReplyBody", () => ({
    __esModule: true,
    default: () => <div data-testid="image-reply-body" />,
}));

vi.mock("../../../hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: () => [true, vi.fn()],
}));

vi.mock("./MStickerBody", () => ({
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
        vi.spyOn(client, "getRoom").mockReturnValue(room);
        vi.spyOn(SettingsStore, "getValue");
        vi.spyOn(SettingsStore, "watchSetting");
        vi.spyOn(SettingsStore, "unwatchSetting").mockImplementation(vi.fn());
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("renders the shared redacted body for redacted events", () => {
        vi.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);
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
        vi.spyOn(event, "isRedacted").mockReturnValue(true);

        const result = renderMessageEvent();

        expect(result.getByText("Message deleted by Moderator")).toBeInTheDocument();
        expect(result.container.querySelector(".mx_RedactedBody")).not.toBeNull();
        expect(result.queryByTestId("textual-body")).toBeNull();
    });

    it("renders the shared Mjolnir body for banned senders", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === "feature_mjolnir");
        vi.spyOn(Mjolnir, "sharedInstance").mockReturnValue({
            isUserBanned: vi.fn().mockReturnValue(true),
            isServerBanned: vi.fn().mockReturnValue(false),
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
        const allowButton = result.getByRole("button", { name: "Show anyway." });

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

    describe("when a gallery is sent", () => {
        function createGalleryEvent(msgtype: string, content: Record<string, unknown> = {}): MatrixEvent {
            return mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: "@alice:example.com",
                room: room.roomId,
                content: {
                    msgtype,
                    body: "",
                    itemtypes: [
                        { itemtype: "m.image", body: "one.png", url: "mxc://server/one" },
                        { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two" },
                    ],
                    ...content,
                },
            });
        }

        it.each(["dm.filament.gallery", "m.gallery"])("renders the gallery body for msgtype %s", (msgtype) => {
            event = createGalleryEvent(msgtype);

            const result = renderMessageEvent();

            expect(result.getByTestId("gallery-body")).toBeVisible();
            // Neither treated as an unknown message nor as a file, and without a caption there is no text.
            expect(result.container.querySelector(".mx_UnknownBody")).toBeNull();
            expect(result.queryByTestId("file-body")).toBeNull();
            expect(result.queryByTestId("textual-body")).toBeNull();
        });

        it("renders the caption under the gallery", () => {
            event = createGalleryEvent("dm.filament.gallery", {
                body: "Our holiday",
                format: "org.matrix.custom.html",
                formatted_body: "Our <strong>holiday</strong>",
            });

            const result = renderMessageEvent();

            const gallery = result.getByTestId("gallery-body");
            const caption = result.getByTestId("textual-body");
            expect(gallery).toBeVisible();
            expect(caption).toBeVisible();
            // Both belong to the content of the one message, the items first.
            expect(gallery.parentElement).toHaveClass("mx_EventTile_content");
            expect(caption.parentElement).toBe(gallery.parentElement);
            expect(gallery.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("does not render a caption for a body of only whitespace", () => {
            event = createGalleryEvent("dm.filament.gallery", { body: "  \n " });

            const result = renderMessageEvent();

            expect(result.getByTestId("gallery-body")).toBeVisible();
            expect(result.queryByTestId("textual-body")).toBeNull();
        });

        it("renders the redacted body for a gallery which was removed", () => {
            vi.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);
            event = createGalleryEvent("dm.filament.gallery", { body: "Our holiday" });
            vi.spyOn(event, "isRedacted").mockReturnValue(true);

            const result = renderMessageEvent();

            expect(result.container.querySelector(".mx_RedactedBody")).not.toBeNull();
            expect(result.queryByTestId("gallery-body")).toBeNull();
        });

        it("does not offer a media helper, as the gallery itself is not one file", () => {
            event = createGalleryEvent("dm.filament.gallery");
            const ref = React.createRef<MessageEvent>();

            render(
                <MatrixClientContext.Provider value={client}>
                    <MessageEvent ref={ref} mxEvent={event} permalinkCreator={new RoomPermalinkCreator(room)} />
                </MatrixClientContext.Provider>,
            );

            expect(ref.current!.getMediaHelper()).toBeUndefined();
        });
    });

    describe("when a message is being edited", () => {
        const mkMessage = (content: Record<string, unknown>): MatrixEvent =>
            mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: "@alice:example.com",
                room: room.roomId,
                content,
            });

        const gallery = {
            msgtype: "dm.filament.gallery",
            body: "",
            itemtypes: [
                { itemtype: "m.image", body: "one.png", url: "mxc://server/one" },
                { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two" },
            ],
        };
        const image = { msgtype: MsgType.Image, body: "image.png", url: "mxc://server/image" };

        const renderEditing = (): RenderResult =>
            render(
                <MatrixClientContext.Provider value={client}>
                    <MessageEvent
                        mxEvent={event}
                        permalinkCreator={new RoomPermalinkCreator(room)}
                        editState={new EditorStateTransfer(event)}
                    />
                </MatrixClientContext.Provider>,
            );

        it.each([
            ["a gallery without a caption", gallery, "gallery-body"],
            ["a gallery with a caption", { ...gallery, body: "Our holiday" }, "gallery-body"],
            ["an image without a caption", image, "image-body"],
            ["an image with a caption", { ...image, body: "Look", filename: "image.png" }, "image-body"],
            ["a video", { msgtype: MsgType.Video, body: "clip.mp4", url: "mxc://server/clip" }, "video-body"],
        ])("renders only the editor in place of %s", (_name, content, bodyTestId) => {
            event = mkMessage(content);

            const result = renderEditing();

            // The editor shows the images and videos itself, so that they can be changed.
            const editor = result.getByTestId("textual-body");
            expect(editor).toHaveAttribute("data-editing", "true");
            expect(result.queryByTestId(bodyTestId)).toBeNull();
            // It is not wrapped as the caption of a body
            expect(result.container.querySelector(".mx_EventTile_content")).toBeNull();
        });

        it.each([
            ["a gallery", { ...gallery, body: "Our holiday" }, "gallery-body"],
            ["an image", { ...image, body: "Look", filename: "image.png" }, "image-body"],
        ])("still renders %s with its caption when it is not being edited", (_name, content, bodyTestId) => {
            event = mkMessage(content);

            const result = renderMessageEvent();

            expect(result.getByTestId(bodyTestId)).toBeVisible();
            expect(result.getByTestId("textual-body")).toHaveAttribute("data-editing", "false");
        });

        describe("in the composer at the bottom", () => {
            beforeEach(() => {
                // Replace the spy of the outer suite, which calls through, with one that turns the lab on.
                vi.mocked(SettingsStore.getValue).mockRestore();
                const original = SettingsStore.getValue;
                vi.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...rest) =>
                    setting === "feature_edit_in_composer" ? true : original(setting, ...rest),
                );
            });

            it.each([
                ["a gallery", { ...gallery, body: "Our holiday" }, "gallery-body"],
                ["an image", { ...image, body: "Look", filename: "image.png" }, "image-body"],
                ["an image without a caption", image, "image-body"],
            ])("keeps showing %s, as the composer holds the editor", (_name, content, bodyTestId) => {
                event = mkMessage(content);

                const result = renderEditing();

                expect(result.getByTestId(bodyTestId)).toBeVisible();
            });

            it("still gives the editing state to the body of a text message, which shows the message", () => {
                event = mkMessage({ msgtype: MsgType.Text, body: "Hello" });

                const result = renderEditing();

                // The textual body itself decides not to show the editor; see its own tests.
                expect(result.getAllByTestId("textual-body")).toHaveLength(1);
            });
        });

        it("renders a text message as before, in the body which hosts the editor", () => {
            event = mkMessage({ msgtype: MsgType.Text, body: "Hello" });

            const result = renderEditing();

            expect(result.getAllByTestId("textual-body")).toHaveLength(1);
            expect(result.getByTestId("textual-body")).toHaveAttribute("data-editing", "true");
        });

        it("leaves a file to its own body, which has no images or videos to change", () => {
            event = mkMessage({ msgtype: MsgType.File, body: "notes.pdf", url: "mxc://server/notes" });

            const result = renderEditing();

            expect(result.getByTestId("file-body")).toBeVisible();
            expect(result.queryByTestId("textual-body")).toBeNull();
        });

        it("renders the redacted body for a gallery which was removed while being edited", () => {
            vi.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);
            event = mkMessage(gallery);
            vi.spyOn(event, "isRedacted").mockReturnValue(true);

            const result = renderEditing();

            expect(result.container.querySelector(".mx_RedactedBody")).not.toBeNull();
            expect(result.queryByTestId("textual-body")).toBeNull();
        });
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
                body: fs.readFileSync(
                    fileURLToPath(import.meta.resolve("../../../../test/unit-tests/images/animated-logo.webp")),
                ),
            });
        }

        it("should render a TextualBody and an ImageBody", () => {
            event = createEvent("image/webp", "image.webp", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            expect(result.getByTestId("image-body")).toBeVisible();
            expect(result.getByTestId("textual-body")).toBeVisible();
        });

        it("should render a TextualBody and a FileBody for mismatched extension", () => {
            event = createEvent("image/webp", "image.exe", MsgType.Image);
            result = renderMessageEvent();
            mockMedia();
            expect(result.getByTestId("file-body")).toBeVisible();
            expect(result.getByTestId("textual-body")).toBeVisible();
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
            expect(result.getByTestId("file-body")).toBeVisible();
            expect(result.getByTestId("textual-body")).toBeVisible();
        });
    });
});
