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
import { type MatrixClient, type MatrixEvent, EventType, type Room, MsgType, M_TEXT } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
    makePollEndEvent,
    makePollResponseEvent,
    makePollStartEvent,
    mkEvent,
    mkRoom,
    setupRoomWithPollEvents,
    stubClient,
} from "test-utils";

import SettingsStore from "../../../settings/SettingsStore";
import MessageEvent from "./MessageEvent";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { Mjolnir } from "../../../mjolnir/Mjolnir";

vi.mock("./MBodyFactory", () => ({
    __esModule: true,
    DecryptionFailureBodyFactory: () => <div data-testid="decryption-failure-body" />,
    FileBodyFactory: () => <div data-testid="file-body" />,
    ImageBodyFactory: () => <div data-testid="image-body" />,
    RedactedBodyFactory: () => <div className="mx_RedactedBody">Message deleted by Moderator</div>,
    VideoBodyFactory: () => <video data-testid="video-body" />,
    renderMBody: () => <div data-testid="file-body" />,
}));

vi.mock("./TextualBodyFactory", () => ({
    __esModule: true,
    TextualBodyFactory: () => <div data-testid="textual-body" />,
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

    it("renders the poll result summary for poll end events", () => {
        event = makePollEndEvent("$poll:example.com", room.roomId, "@alice:example.com");
        event.getContent()[M_TEXT.name] = "The poll has ended. Top answer: yes";

        const result = renderMessageEvent();

        expect(result.getByText("The poll has ended. Top answer: yes")).toBeInTheDocument();
        expect(result.container.querySelector(".mx_PollEndBody")).not.toBeNull();
    });

    it("falls back to a generic summary for poll end events without a text fallback", () => {
        event = makePollEndEvent("$poll:example.com", room.roomId, "@alice:example.com");
        delete event.getContent()[M_TEXT.name];

        const result = renderMessageEvent();

        expect(result.getByText(/has ended a poll/)).toBeInTheDocument();
    });

    describe("when the ended poll is known", () => {
        const pollStartEvent = makePollStartEvent("Totally a poll", "@alice:example.com", undefined, {
            roomId: "!room:example.com",
            ts: 1,
        });

        const setupEndedPoll = async (votes: MatrixEvent[]): Promise<void> => {
            // Sent by the local user, so the poll accepts it as a valid end event
            event = makePollEndEvent(pollStartEvent.getId()!, "!room:example.com", client.getSafeUserId(), 100);
            // A fallback in another language, which should be replaced by the locally counted result
            event.getContent()[M_TEXT.name] = "ethay ollpay ashay endedyay . optay result: oesshay.";
            room = await setupRoomWithPollEvents([pollStartEvent], votes, [event], vi.mocked(client));
        };

        it("shows the top answer counted from the votes", async () => {
            await setupEndedPoll([
                makePollResponseEvent(pollStartEvent.getId()!, ["shoes"], "@bob:example.com", room.roomId, 10),
                makePollResponseEvent(pollStartEvent.getId()!, ["shoes"], "@carol:example.com", room.roomId, 10),
                makePollResponseEvent(pollStartEvent.getId()!, ["socks"], "@dan:example.com", room.roomId, 10),
                // Cast after the poll ended, so should not be counted
                makePollResponseEvent(pollStartEvent.getId()!, ["socks"], "@erin:example.com", room.roomId, 200),
                makePollResponseEvent(pollStartEvent.getId()!, ["socks"], "@frank:example.com", room.roomId, 200),
            ]);

            const result = renderMessageEvent();

            expect(await result.findByText("The poll has ended. Top answer: Shoes")).toBeInTheDocument();
        });

        it("says when nobody voted", async () => {
            await setupEndedPoll([]);

            const result = renderMessageEvent();

            expect(await result.findByText("The poll has ended. No votes were cast.")).toBeInTheDocument();
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
