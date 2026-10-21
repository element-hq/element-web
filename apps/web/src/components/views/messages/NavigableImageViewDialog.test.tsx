/*
Copyright 2026 Johannes Camp jcamp@gmx.de

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import * as MediaEventHelperModule from "../../../utils/MediaEventHelper";
import NavigableImageViewDialog from "./NavigableImageViewDialog";

const { mockImageView, mockClient } = vi.hoisted(() => ({
    mockImageView: vi.fn(),
    mockClient: {
        getRoom: vi.fn(),
        getEventTimeline: vi.fn(),
        paginateEventTimeline: vi.fn(),
    },
}));

// ---- Mock ImageView ----
vi.mock("../elements/ImageView", () => ({
    default: function MockImageView(props: any) {
        mockImageView(props);
        return (
            <div>
                <div data-testid="name">{props.name}</div>
                <div data-testid="src">{props.src}</div>
                <div data-testid="hasPrev">{String(Boolean(props.onPrev))}</div>
                <div data-testid="hasNext">{String(Boolean(props.onNext))}</div>

                <button onClick={() => props.onPrev?.()}>prev</button>
                <button onClick={() => props.onNext?.()}>next</button>
            </div>
        );
    },
}));

// ---- Mock MediaEventHelper ----
vi.mock("../../../utils/MediaEventHelper", () => {
    // State lives inside the mock module
    let sourceUrlValue: Promise<string | null> = Promise.resolve("blob:mock-src");
    // Per-event URLs, keyed by event id, taking precedence over the default above
    const urlsByEvent = new Map<string, { source: string | null; thumbnail: string | null }>();

    class MediaEventHelper {
        public sourceUrl: { value: Promise<string | null> };
        public thumbnailUrl: { value: Promise<string | null> };
        public destroy = vi.fn();

        public constructor(event: { getId(): string }) {
            const urls = urlsByEvent.get(event.getId());
            this.sourceUrl = { value: urls ? Promise.resolve(urls.source) : sourceUrlValue };
            this.thumbnailUrl = { value: Promise.resolve(urls?.thumbnail ?? null) };
        }
    }

    return {
        MediaEventHelper,
        // Test-only helpers to control the promises
        setSourceUrlValue: (p: Promise<string | null>) => {
            sourceUrlValue = p;
            urlsByEvent.clear();
        },
        setEventUrls: (eventId: string, source: string | null, thumbnail: string | null) => {
            urlsByEvent.set(eventId, { source, thumbnail });
        },
    };
});

// ---- Mock MatrixClientPeg.safeGet() ----
vi.mock("../../../MatrixClientPeg", () => ({
    MatrixClientPeg: {
        safeGet: () => mockClient,
    },
}));

// Helpers to create minimal MatrixEvent-like objects
function mkMessageEvent(
    id: string,
    roomId: string,
    content: Record<string, unknown>,
    thread?: { thread: unknown; isRoot: boolean },
) {
    return {
        getId: () => id,
        getRoomId: () => roomId,
        isRedacted: () => false,
        getType: () => "m.room.message",
        getContent: () => content,
        getThread: () => thread?.thread,
        isThreadRoot: thread?.isRoot ?? false,
    } as any;
}

function mkImageEvent(id: string, roomId: string, body: string, thread?: { thread: unknown; isRoot: boolean }) {
    return mkMessageEvent(id, roomId, { msgtype: "m.image", body }, thread);
}

describe("NavigableImageViewDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (MediaEventHelperModule as any).setSourceUrlValue(Promise.resolve("blob:mock-src"));
    });

    it("renders and navigates between images in the same timeline", async () => {
        const roomId = "!room:server";
        const ev1 = mkImageEvent("$img1", roomId, "first");
        const ev2 = mkImageEvent("$img2", roomId, "second");

        const timeline = { getEvents: () => [ev1, ev2] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        let resolveSource!: (v: string | null) => void;
        const sourcePromise = new Promise<string | null>((res) => {
            resolveSource = res;
        });
        (MediaEventHelperModule as any).setSourceUrlValue(sourcePromise);

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        // src should initially be the provided initialSrc
        expect(await screen.findByTestId("src")).toHaveTextContent("blob:initial-src");

        // now resolve MediaEventHelper sourceUrl then ImageView src should update
        resolveSource("blob:mock-src");
        await waitFor(() => {
            expect(screen.getByTestId("src")).toHaveTextContent("blob:mock-src");
        });

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true");

        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("second");
        expect(screen.getByTestId("hasNext")).toHaveTextContent("false");
        expect(screen.getByTestId("hasPrev")).toHaveTextContent("true");
        await userEvent.click(screen.getByText("prev"));
        expect(await screen.findByTestId("name")).toHaveTextContent("first");
    });

    it("attempts pagination when navigating prev at the start of the loaded image list", async () => {
        const roomId = "!room:server";
        const ev1 = mkImageEvent("$img1", roomId, "first");

        const timeline = { getEvents: () => [ev1] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);
        mockClient.paginateEventTimeline.mockResolvedValue(false);

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        await userEvent.click(screen.getByText("prev"));

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });

        await waitFor(() => {
            expect(screen.getByTestId("hasPrev")).toHaveTextContent("false");
        });
    });

    it("paginates backwards and navigates to an earlier image when found", async () => {
        const roomId = "!room:server";
        const ev0 = mkImageEvent("$img0", roomId, "earlier");
        const ev1 = mkImageEvent("$img1", roomId, "first");

        // timeline starts with only the initial event
        const events: any[] = [ev1];
        const timeline = { getEvents: () => events };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        // When paginating, insert an earlier image at the start and report success
        mockClient.paginateEventTimeline.mockImplementation(async () => {
            events.unshift(ev0);
            return true;
        });

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");

        // Click prev while at index 0: should paginate and then navigate to ev0
        await userEvent.click(screen.getByText("prev"));

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });

        // After pagination inserts ev0, dialog should navigate to it
        expect(await screen.findByTestId("name")).toHaveTextContent("earlier");
    });

    it("navigates the thread's images when opened from a reply inside a thread", async () => {
        const roomId = "!room:server";
        const roomTimeline = { getEvents: () => [mkImageEvent("$roomimg", roomId, "room image")] };
        const roomTimelineSet = { getLiveTimeline: () => roomTimeline };
        const room = { getUnfilteredTimelineSet: () => roomTimelineSet };

        const threadTimelineSet = { getLiveTimeline: vi.fn() };
        const thread = { timelineSet: threadTimelineSet };
        const reply1 = mkImageEvent("$reply1", roomId, "first reply", { thread, isRoot: false });
        const reply2 = mkImageEvent("$reply2", roomId, "second reply", { thread, isRoot: false });
        const threadTimeline = { getEvents: () => [reply1, reply2] };
        threadTimelineSet.getLiveTimeline.mockReturnValue(threadTimeline);

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockImplementation(async (set: unknown) =>
            set === threadTimelineSet ? threadTimeline : roomTimeline,
        );

        render(<NavigableImageViewDialog initialEvent={reply1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first reply");
        await waitFor(() => {
            expect(mockClient.getEventTimeline).toHaveBeenCalledWith(threadTimelineSet, "$reply1");
        });
        expect(mockClient.getEventTimeline).not.toHaveBeenCalledWith(roomTimelineSet, "$reply1");

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        await userEvent.click(screen.getByText("next"));
        expect(await screen.findByTestId("name")).toHaveTextContent("second reply");
        expect(screen.getByTestId("hasNext")).toHaveTextContent("false");
    });

    it("navigates the room's images when opened from an image that is a thread root", async () => {
        const roomId = "!room:server";
        const thread = { timelineSet: { getLiveTimeline: vi.fn() } };
        const root = mkImageEvent("$root", roomId, "root", { thread, isRoot: true });
        const later = mkImageEvent("$later", roomId, "later");

        const roomTimeline = { getEvents: () => [root, later] };
        const roomTimelineSet = { getLiveTimeline: () => roomTimeline };
        const room = { getUnfilteredTimelineSet: () => roomTimelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(roomTimeline);

        render(<NavigableImageViewDialog initialEvent={root} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("root");
        await waitFor(() => {
            expect(mockClient.getEventTimeline).toHaveBeenCalledWith(roomTimelineSet, "$root");
        });
        expect(mockClient.getEventTimeline).not.toHaveBeenCalledWith(thread.timelineSet, "$root");

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        await userEvent.click(screen.getByText("next"));
        expect(await screen.findByTestId("name")).toHaveTextContent("later");
    });

    it("only navigates between images, skipping videos, files and images that render as files", async () => {
        const roomId = "!room:server";
        const img1 = mkImageEvent("$img1", roomId, "first");
        const video = mkMessageEvent("$video", roomId, { msgtype: "m.video", body: "clip.mp4" });
        const file = mkMessageEvent("$file", roomId, { msgtype: "m.file", body: "doc.pdf" });
        // Encrypted SVG without a thumbnail is rendered as a file in the timeline, so it is not an image here
        const unsafeSvg = mkMessageEvent("$svg", roomId, {
            msgtype: "m.image",
            body: "unsafe.svg",
            file: { url: "mxc://server/svg" },
            info: { mimetype: "image/svg+xml" },
        });
        const img2 = mkImageEvent("$img2", roomId, "second");

        const timeline = { getEvents: () => [img1, video, file, unsafeSvg, img2] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        render(<NavigableImageViewDialog initialEvent={img1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(await screen.findByTestId("name")).toHaveTextContent("first");
        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });

        await userEvent.click(screen.getByText("next"));
        expect(await screen.findByTestId("name")).toHaveTextContent("second");
        expect(screen.getByTestId("hasNext")).toHaveTextContent("false");

        await userEvent.click(screen.getByText("prev"));
        expect(await screen.findByTestId("name")).toHaveTextContent("first");
    });

    it("shows an unencrypted SVG through its http URL rather than a blob URL when navigating to it", async () => {
        const roomId = "!room:server";
        const png = mkImageEvent("$png", roomId, "photo.png");
        const svg = mkMessageEvent("$svg", roomId, {
            msgtype: "m.image",
            body: "drawing.svg",
            url: "mxc://server/svg",
            info: { mimetype: "image/svg+xml" },
        });
        (MediaEventHelperModule as any).setEventUrls("$svg", "https://server/_matrix/media/drawing.svg", null);

        const timeline = { getEvents: () => [png, svg] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        render(<NavigableImageViewDialog initialEvent={png} initialSrc="blob:initial-src" onFinished={() => {}} />);

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("drawing.svg");
        await waitFor(() => {
            expect(screen.getByTestId("src")).toHaveTextContent("https://server/_matrix/media/drawing.svg");
        });
        expect(screen.getByTestId("src")).not.toHaveTextContent("blob:");
    });

    it("shows the thumbnail of an encrypted SVG when navigating to it, as the timeline does", async () => {
        const roomId = "!room:server";
        const png = mkImageEvent("$png", roomId, "photo.png");
        const svg = mkMessageEvent("$svg", roomId, {
            msgtype: "m.image",
            body: "drawing.svg",
            file: { url: "mxc://server/svg" },
            info: {
                mimetype: "image/svg+xml",
                thumbnail_file: { url: "mxc://server/thumb" },
                thumbnail_info: { mimetype: "image/png", w: 100, h: 100 },
            },
        });
        (MediaEventHelperModule as any).setEventUrls("$svg", "blob:decrypted-svg", "blob:decrypted-thumbnail");

        const timeline = { getEvents: () => [png, svg] };
        const timelineSet = { getLiveTimeline: () => timeline };
        const room = { getUnfilteredTimelineSet: () => timelineSet };

        mockClient.getRoom.mockReturnValue(room);
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        render(<NavigableImageViewDialog initialEvent={png} initialSrc="blob:initial-src" onFinished={() => {}} />);

        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });
        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("drawing.svg");
        await waitFor(() => {
            expect(screen.getByTestId("src")).toHaveTextContent("blob:decrypted-thumbnail");
        });
    });
});
