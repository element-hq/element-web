/*
Copyright 2026 Johannes Camp jcamp@gmx.de

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import * as MediaEventHelperModule from "../../utils/MediaEventHelper";
import { LightboxNavigationViewModel } from "./LightboxNavigationViewModel";

const { mockClient } = vi.hoisted(() => ({
    mockClient: {
        getRoom: vi.fn(),
        getEventTimeline: vi.fn(),
        paginateEventTimeline: vi.fn(),
    },
}));

vi.mock("../../utils/MediaEventHelper", () => {
    // URLs per event id; events without an entry resolve to the default source URL
    const urlsByEvent = new Map<string, { source: Promise<string | null>; thumbnail: Promise<string | null> }>();
    const instances: MediaEventHelper[] = [];

    class MediaEventHelper {
        public sourceUrl: { value: Promise<string | null> };
        public thumbnailUrl: { value: Promise<string | null> };
        public destroy = vi.fn();

        public constructor(event: { getId(): string }) {
            const urls = urlsByEvent.get(event.getId());
            this.sourceUrl = { value: urls?.source ?? Promise.resolve("blob:mock-src") };
            this.thumbnailUrl = { value: urls?.thumbnail ?? Promise.resolve(null) };
            instances.push(this);
        }
    }

    return {
        MediaEventHelper,
        // Test-only helpers
        setEventUrls: (eventId: string, source: Promise<string | null>, thumbnail: Promise<string | null>) => {
            urlsByEvent.set(eventId, { source, thumbnail });
        },
        resetMock: () => {
            urlsByEvent.clear();
            instances.length = 0;
        },
        helperInstances: instances,
    };
});

const mediaMock = MediaEventHelperModule as unknown as {
    setEventUrls(eventId: string, source: Promise<string | null>, thumbnail: Promise<string | null>): void;
    resetMock(): void;
    helperInstances: Array<{ destroy: ReturnType<typeof vi.fn> }>;
};

const roomId = "!room:server";

// Minimal MatrixEvent-like objects
function mkMessageEvent(
    id: string,
    content: Record<string, unknown>,
    thread?: { thread: unknown; isRoot: boolean },
): MatrixEvent {
    return {
        getId: () => id,
        getRoomId: () => roomId,
        isRedacted: () => false,
        getType: () => "m.room.message",
        getContent: () => content,
        getThread: () => thread?.thread,
        isThreadRoot: thread?.isRoot ?? false,
    } as unknown as MatrixEvent;
}

function mkImageEvent(id: string, body: string, thread?: { thread: unknown; isRoot: boolean }): MatrixEvent {
    return mkMessageEvent(id, { msgtype: "m.image", body }, thread);
}

/** Set up a room whose main timeline holds the given (mutable) events. */
function mockRoomTimeline(events: MatrixEvent[]): { getEvents(): MatrixEvent[] } {
    const timeline = { getEvents: () => events };
    const timelineSet = { getLiveTimeline: () => timeline };
    mockClient.getRoom.mockReturnValue({ getUnfilteredTimelineSet: () => timelineSet });
    mockClient.getEventTimeline.mockResolvedValue(timeline);
    return timeline;
}

function createViewModel(initialEvent: MatrixEvent): LightboxNavigationViewModel {
    return new LightboxNavigationViewModel({
        client: mockClient as unknown as MatrixClient,
        initialEvent,
        initialSrc: "blob:initial-src",
    });
}

/** Wait until the timeline has loaded, which is when navigation becomes possible. */
async function loaded(vm: LightboxNavigationViewModel): Promise<void> {
    await vi.waitFor(() => expect(mockClient.getEventTimeline).toHaveBeenCalled());
    await vi.waitFor(() => expect(vm.getSnapshot().canGoToPrevious || vm.getSnapshot().canGoToNext).toBe(true));
}

describe("LightboxNavigationViewModel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mediaMock.resetMock();
    });

    it("starts on the initial image and resolves its URL", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        mockRoomTimeline([ev1]);

        let resolveSource!: (url: string) => void;
        mediaMock.setEventUrls("$img1", new Promise((resolve) => (resolveSource = resolve)), Promise.resolve(null));

        const vm = createViewModel(ev1);
        expect(vm.getSnapshot()).toMatchObject({
            currentEvent: ev1,
            name: "first",
            src: "blob:initial-src",
            canGoToPrevious: false,
            canGoToNext: false,
            isNavigating: false,
        });

        resolveSource("blob:resolved-src");
        await vi.waitFor(() => expect(vm.getSnapshot().src).toBe("blob:resolved-src"));
    });

    it("names images without a body 'Attachment'", () => {
        const ev = mkMessageEvent("$img", { msgtype: "m.image", body: "" });
        mockRoomTimeline([ev]);
        expect(createViewModel(ev).getSnapshot().name).toBe("Attachment");
    });

    it("navigates between images in the same timeline", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        mockRoomTimeline([ev1, ev2]);

        const vm = createViewModel(ev1);
        await loaded(vm);
        // Older history may still hold an image
        expect(vm.getSnapshot()).toMatchObject({ canGoToPrevious: true, canGoToNext: true });

        vm.goToNext();
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev2, name: "second", canGoToNext: false });
        expect(vm.getSnapshot().canGoToPrevious).toBe(true);

        await vm.goToPrevious();
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev1, name: "first", canGoToNext: true });
        expect(mockClient.paginateEventTimeline).not.toHaveBeenCalled();
    });

    it("stops offering previous once the start of the history is reached", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const timeline = mockRoomTimeline([ev1]);
        mockClient.paginateEventTimeline.mockResolvedValue(false);

        const vm = createViewModel(ev1);
        await loaded(vm);

        await vm.goToPrevious();

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev1, canGoToPrevious: false, isNavigating: false });
    });

    it("paginates backwards and navigates to an earlier image when found", async () => {
        const ev0 = mkImageEvent("$img0", "earlier");
        const ev1 = mkImageEvent("$img1", "first");
        const events = [ev1];
        const timeline = mockRoomTimeline(events);

        let finishPage!: () => void;
        mockClient.paginateEventTimeline.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    finishPage = () => {
                        events.unshift(ev0);
                        resolve(true);
                    };
                }),
        );

        const vm = createViewModel(ev1);
        await loaded(vm);

        const navigation = vm.goToPrevious();
        // The buttons are disabled while older history is being fetched
        expect(vm.getSnapshot().isNavigating).toBe(true);
        finishPage();
        await navigation;

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 50 });
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev0, name: "earlier", isNavigating: false });
        expect(vm.getSnapshot().canGoToNext).toBe(true);
    });

    it("navigates to an earlier image found on the last page of the history", async () => {
        const ev0 = mkImageEvent("$img0", "earliest");
        const ev1 = mkImageEvent("$img1", "first");
        const events = [ev1];
        mockRoomTimeline(events);
        mockClient.paginateEventTimeline.mockImplementation(async () => {
            events.unshift(ev0);
            return false; // start of the history reached
        });

        const vm = createViewModel(ev1);
        await loaded(vm);
        await vm.goToPrevious();

        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev0, canGoToPrevious: false, isNavigating: false });
    });

    it("ignores previous and next while older history is being fetched", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        mockRoomTimeline([ev1, ev2]);
        let finishPage!: (hasMore: boolean) => void;
        mockClient.paginateEventTimeline.mockReturnValue(new Promise<boolean>((resolve) => (finishPage = resolve)));

        const vm = createViewModel(ev1);
        await loaded(vm);
        const navigation = vm.goToPrevious();

        vm.goToNext();
        await vm.goToPrevious();
        expect(vm.getSnapshot().currentEvent).toBe(ev1);
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(1);

        finishPage(false);
        await navigation;
    });

    it("logs and recovers when fetching older history fails", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        mockRoomTimeline([ev1]);
        mockClient.paginateEventTimeline.mockRejectedValue(new Error("network"));

        const vm = createViewModel(ev1);
        await loaded(vm);
        await vm.goToPrevious();

        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev1, isNavigating: false, canGoToPrevious: true });
    });

    it("gives up after a few pages without images, letting the user look further back", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const events: MatrixEvent[] = [ev1];
        mockRoomTimeline(events);
        mockClient.paginateEventTimeline.mockImplementation(async () => {
            events.unshift(mkMessageEvent(`$text${events.length}`, { msgtype: "m.text", body: "hi" }));
            return true;
        });

        const vm = createViewModel(ev1);
        await loaded(vm);
        await vm.goToPrevious();

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(5);
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev1, canGoToPrevious: true, isNavigating: false });
    });

    it("navigates the thread's images when opened from a reply inside a thread", async () => {
        const roomTimeline = { getEvents: () => [mkImageEvent("$roomimg", "room image")] };
        const roomTimelineSet = { getLiveTimeline: () => roomTimeline };
        mockClient.getRoom.mockReturnValue({ getUnfilteredTimelineSet: () => roomTimelineSet });

        const threadTimelineSet = { getLiveTimeline: vi.fn() };
        const thread = { timelineSet: threadTimelineSet };
        const reply1 = mkImageEvent("$reply1", "first reply", { thread, isRoot: false });
        const reply2 = mkImageEvent("$reply2", "second reply", { thread, isRoot: false });
        const threadTimeline = { getEvents: () => [reply1, reply2] };
        mockClient.getEventTimeline.mockImplementation(async (set: unknown) =>
            set === threadTimelineSet ? threadTimeline : roomTimeline,
        );

        const vm = createViewModel(reply1);
        await loaded(vm);

        expect(mockClient.getEventTimeline).toHaveBeenCalledWith(threadTimelineSet, "$reply1");
        expect(mockClient.getEventTimeline).not.toHaveBeenCalledWith(roomTimelineSet, "$reply1");

        vm.goToNext();
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: reply2, canGoToNext: false });
    });

    it("navigates the room's images when opened from an image that is a thread root", async () => {
        const thread = { timelineSet: { getLiveTimeline: vi.fn() } };
        const root = mkImageEvent("$root", "root", { thread, isRoot: true });
        const later = mkImageEvent("$later", "later");
        mockRoomTimeline([root, later]);

        const vm = createViewModel(root);
        await loaded(vm);

        expect(mockClient.getEventTimeline).not.toHaveBeenCalledWith(thread.timelineSet, "$root");
        vm.goToNext();
        expect(vm.getSnapshot().currentEvent).toBe(later);
    });

    it("falls back to the live timeline when the event's timeline cannot be loaded", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        mockRoomTimeline([ev1, ev2]);
        mockClient.getEventTimeline.mockRejectedValue(new Error("not found"));

        const vm = createViewModel(ev1);
        await vi.waitFor(() => expect(vm.getSnapshot().canGoToNext).toBe(true));
    });

    it("only navigates between images, skipping videos, files and images that render as files", async () => {
        const img1 = mkImageEvent("$img1", "first");
        const video = mkMessageEvent("$video", { msgtype: "m.video", body: "clip.mp4" });
        const file = mkMessageEvent("$file", { msgtype: "m.file", body: "doc.pdf" });
        // Encrypted SVG without a thumbnail is rendered as a file in the timeline, so it is not an image here
        const unsafeSvg = mkMessageEvent("$svg", {
            msgtype: "m.image",
            body: "unsafe.svg",
            file: { url: "mxc://server/svg" },
            info: { mimetype: "image/svg+xml" },
        });
        const img2 = mkImageEvent("$img2", "second");
        mockRoomTimeline([img1, video, file, unsafeSvg, img2]);

        const vm = createViewModel(img1);
        await loaded(vm);

        vm.goToNext();
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: img2, canGoToNext: false });
        await vm.goToPrevious();
        expect(vm.getSnapshot().currentEvent).toBe(img1);
    });

    it("shows an unencrypted SVG through its http URL", async () => {
        const png = mkImageEvent("$png", "photo.png");
        const svg = mkMessageEvent("$svg", {
            msgtype: "m.image",
            body: "drawing.svg",
            url: "mxc://server/svg",
            info: { mimetype: "image/svg+xml" },
        });
        mediaMock.setEventUrls(
            "$svg",
            Promise.resolve("https://server/_matrix/media/drawing.svg"),
            Promise.resolve(null),
        );
        mockRoomTimeline([png, svg]);

        const vm = createViewModel(png);
        await loaded(vm);
        vm.goToNext();

        await vi.waitFor(() => expect(vm.getSnapshot().src).toBe("https://server/_matrix/media/drawing.svg"));
    });

    it("shows the thumbnail of an encrypted SVG, as the timeline does", async () => {
        const png = mkImageEvent("$png", "photo.png");
        const svg = mkMessageEvent("$svg", {
            msgtype: "m.image",
            body: "drawing.svg",
            file: { url: "mxc://server/svg" },
            info: {
                mimetype: "image/svg+xml",
                thumbnail_file: { url: "mxc://server/thumb" },
                thumbnail_info: { mimetype: "image/png", w: 100, h: 100 },
            },
        });
        mediaMock.setEventUrls("$svg", Promise.resolve("blob:decrypted-svg"), Promise.resolve("blob:decrypted-thumb"));
        mockRoomTimeline([png, svg]);

        const vm = createViewModel(png);
        await loaded(vm);
        vm.goToNext();

        await vi.waitFor(() => expect(vm.getSnapshot().src).toBe("blob:decrypted-thumb"));
    });

    it("ignores the URL of an image that was navigated away from before it resolved", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        const ev3 = mkImageEvent("$img3", "third");
        let resolveSlow!: (url: string) => void;
        mediaMock.setEventUrls("$img2", new Promise((resolve) => (resolveSlow = resolve)), Promise.resolve(null));
        mediaMock.setEventUrls("$img3", Promise.resolve("blob:third"), Promise.resolve(null));
        mockRoomTimeline([ev1, ev2, ev3]);

        const vm = createViewModel(ev1);
        await loaded(vm);
        vm.goToNext();
        vm.goToNext();
        await vi.waitFor(() => expect(vm.getSnapshot().src).toBe("blob:third"));

        resolveSlow("blob:second");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(vm.getSnapshot()).toMatchObject({ currentEvent: ev3, src: "blob:third" });
    });

    it("destroys the media helper of each image it moves away from, and the last one when disposed", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        mockRoomTimeline([ev1, ev2]);

        const vm = createViewModel(ev1);
        await loaded(vm);
        vm.goToNext();

        const [first, second] = mediaMock.helperInstances;
        expect(first.destroy).toHaveBeenCalled();
        expect(second.destroy).not.toHaveBeenCalled();

        vm.dispose();
        expect(second.destroy).toHaveBeenCalled();
    });

    it("ignores a timeline that loads after it was disposed", async () => {
        const ev1 = mkImageEvent("$img1", "first");
        const ev2 = mkImageEvent("$img2", "second");
        const timeline = mockRoomTimeline([ev1, ev2]);
        let resolveTimeline!: (t: unknown) => void;
        mockClient.getEventTimeline.mockReturnValue(new Promise((resolve) => (resolveTimeline = resolve)));

        const vm = createViewModel(ev1);
        const listener = vi.fn();
        vm.subscribe(listener);
        vm.dispose();

        resolveTimeline(timeline);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(listener).not.toHaveBeenCalled();
        expect(vm.getSnapshot().canGoToNext).toBe(false);
    });
});
