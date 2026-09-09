/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    Direction,
    EventType,
    MatrixEvent,
    MatrixEventEvent,
    PendingEventOrdering,
    ReceiptType,
    Room,
    RoomEvent,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { type TimelineItem } from "@element-hq/web-shared-components";
import { createTestClient, mkMessage } from "test-utils";

import SettingsStore from "../../../settings/SettingsStore";
import { RoomTimelineViewModel } from "./RoomTimelineViewModel";

vi.mock("../../../settings/SettingsStore");

const ROOM_ID = "!room:example.org";
const USER_ID = "@alice:example.org";
const OTHER_USER_ID = "@bob:example.org";

describe("RoomTimelineViewModel", () => {
    let client: MatrixClient;
    let room: Room;
    let vms: RoomTimelineViewModel[];

    /** A plain text message. Pass `ts` when a test cares which day it landed on. */
    const makeMessage = (id: string, opts: { user?: string; ts?: number; msg?: string } = {}): MatrixEvent =>
        mkMessage({
            room: ROOM_ID,
            user: opts.user ?? USER_ID,
            msg: opts.msg ?? `message ${id}`,
            event: true,
            id,
            ts: opts.ts,
        });

    /**
     * A message that is encrypted and has not decrypted yet, so the view model holds it back.
     * Call the returned `decrypt()` to make it readable and fire the SDK's Decrypted event.
     */
    const makeEncryptedPending = (id: string): { event: MatrixEvent; decrypt: () => void } => {
        const event = makeMessage(id);
        let decrypted = false;
        vi.spyOn(event, "getWireType").mockReturnValue(EventType.RoomMessageEncrypted);
        vi.spyOn(event, "isEncrypted").mockReturnValue(true);
        vi.spyOn(event, "isDecryptionFailure").mockReturnValue(false);
        vi.spyOn(event, "getClearContent").mockImplementation(() => (decrypted ? { body: "secret" } : null) as any);
        return {
            event,
            decrypt: () => {
                decrypted = true;
                client.emit(MatrixEventEvent.Decrypted, event);
            },
        };
    };

    /** Put `events` into the room's live timeline, oldest first. */
    const seedTimeline = (events: MatrixEvent[]): void => {
        const timelineSet = room.getUnfilteredTimelineSet();
        for (const event of events) {
            timelineSet.addLiveEvent(event, { addToState: false });
        }
    };

    /** Construct, start, and let the async initial load settle. */
    const createStartedViewModel = async (initialEventId?: string): Promise<RoomTimelineViewModel> => {
        const vm = new RoomTimelineViewModel({ client, room, initialEventId });
        vms.push(vm);
        vm.start();
        await vi.waitFor(() => expect(vm.getSnapshot().items.length).toBeGreaterThan(0));
        return vm;
    };

    const eventKeys = (items: TimelineItem[]): string[] => items.filter((i) => i.kind === "event").map((i) => i.key);

    const kinds = (items: TimelineItem[]): string[] => items.map((i) => i.kind);

    /** Position of a message in the rendered list, which also contains date separators etc. */
    const indexOfKey = (items: TimelineItem[], key: string): number => items.findIndex((i) => i.key === key);

    beforeEach(() => {
        vms = [];
        client = createTestClient();
        room = new Room(ROOM_ID, client, USER_ID, { pendingEventOrdering: PendingEventOrdering.Detached });
        vi.spyOn(client, "getRoom").mockReturnValue(room);

        // The only two settings the view model reads, at their real-world defaults. A test that
        // cares about either one overrides this.
        vi.mocked(SettingsStore).getValue.mockImplementation((key): any => {
            if (key === "sendReadReceipts") return true;
            if (key === "showHiddenEventsInTimeline") return false;
            return undefined;
        });
        vi.mocked(SettingsStore).watchSetting.mockReturnValue("watch-ref");
        vi.mocked(SettingsStore).unwatchSetting.mockImplementation(() => {});

        localStorage.clear();
    });

    afterEach(() => {
        for (const vm of vms) vm.dispose();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe("lifecycle", () => {
        it("does not subscribe or load until start() is called", () => {
            // Constructing must stay side-effect free: React StrictMode builds two
            // instances and throws one away, and anything subscribed here would leak.
            // Counted on AccountData because only the view model listens for that —
            // Room.timeline also has listeners from the SDK's own timeline plumbing.
            const before = room.listenerCount(RoomEvent.AccountData);

            const vm = new RoomTimelineViewModel({ client, room });
            vms.push(vm);

            expect(room.listenerCount(RoomEvent.AccountData)).toBe(before);
            expect(vm.getSnapshot().items).toEqual([]);

            vm.start();

            expect(room.listenerCount(RoomEvent.AccountData)).toBeGreaterThan(before);
        });

        it("ignores a second start()", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            const itemsAfterFirstStart = vm.getSnapshot().items;

            vm.start();

            expect(vm.getSnapshot().items).toBe(itemsAfterFirstStart);
        });

        it("ignores start() after dispose", () => {
            const vm = new RoomTimelineViewModel({ client, room });
            vms.push(vm);
            vm.dispose();

            vm.start();

            expect(vm.getSnapshot().items).toEqual([]);
        });
    });

    describe("initial load", () => {
        it("publishes the room's messages as event items", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);

            const vm = await createStartedViewModel();

            expect(eventKeys(vm.getSnapshot().items)).toEqual(["$a", "$b", "$c"]);
        });

        it("reports being at the live end when loading live", async () => {
            seedTimeline([makeMessage("$a")]);

            const vm = await createStartedViewModel();

            expect(vm.getSnapshot().atLiveEnd).toBe(true);
        });

        it("highlights and anchors the permalink event it was opened on", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);

            const vm = await createStartedViewModel("$b");

            const snapshot = vm.getSnapshot();
            expect(snapshot.highlightedEventId).toBe("$b");
            expect(snapshot.pendingAnchor).toEqual({ targetKey: "$b", align: "center" });
        });
    });

    describe("item projection", () => {
        it("groups consecutive messages from the same sender as continuations", async () => {
            seedTimeline([
                makeMessage("$a", { user: USER_ID }),
                makeMessage("$b", { user: USER_ID }),
                makeMessage("$c", { user: OTHER_USER_ID }),
            ]);

            const vm = await createStartedViewModel();

            const events = vm.getSnapshot().items.filter((i) => i.kind === "event");
            expect(events.map((e) => e.continuation)).toEqual([false, true, false]);
        });

        it("marks the last message of a sender's run so its group can be closed off", async () => {
            seedTimeline([
                makeMessage("$a", { user: USER_ID }),
                makeMessage("$b", { user: USER_ID }),
                makeMessage("$c", { user: OTHER_USER_ID }),
            ]);

            const vm = await createStartedViewModel();

            const events = vm.getSnapshot().items.filter((i) => i.kind === "event");
            expect(events.map((e) => e.lastInSection)).toEqual([false, true, true]);
        });

        it("separates messages sent on different days", async () => {
            const day1 = new Date("2026-03-01T10:00:00Z").getTime();
            const day2 = new Date("2026-03-02T10:00:00Z").getTime();
            seedTimeline([makeMessage("$a", { ts: day1 }), makeMessage("$b", { ts: day2 })]);

            const vm = await createStartedViewModel();

            // One separator per distinct day, each immediately before its first message.
            const items = vm.getSnapshot().items;
            const separators = items.filter((i) => i.kind === "date-separator");
            expect(separators.length).toBeGreaterThanOrEqual(1);
            const day2SeparatorIndex = items.findIndex((i) => i.kind === "date-separator" && items.indexOf(i) > 0);
            expect(items[day2SeparatorIndex + 1]?.key).toBe("$b");
        });

        it("places a read marker after the last message the user has read", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);
            room.addAccountData([
                new MatrixEvent({
                    type: EventType.FullyRead,
                    room_id: ROOM_ID,
                    content: { event_id: "$b" },
                }),
            ]);

            const vm = await createStartedViewModel();

            const items = vm.getSnapshot().items;
            const markerIndex = items.findIndex((i) => i.kind === "read-marker");
            expect(markerIndex).toBeGreaterThan(-1);
            expect(items[markerIndex - 1].key).toBe("$b");
        });
    });

    describe("live messages", () => {
        it("adds a message that arrives while the timeline is open", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();

            const incoming = makeMessage("$b");
            room.getUnfilteredTimelineSet().addLiveEvent(incoming, { addToState: false });
            room.emit(RoomEvent.Timeline, incoming, room, false, false, {
                timeline: room.getLiveTimeline(),
                liveEvent: true,
            } as any);

            await vi.waitFor(() => expect(eventKeys(vm.getSnapshot().items)).toContain("$b"));
        });
    });

    describe("pagination", () => {
        it("asks for older messages when the top of the list is reached", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            // Pagination is suppressed until the initial placement settles, so report
            // that first — as the view does before the user can scroll.
            vm.onAnchorReached();
            const paginate = vi.spyOn((vm as any).timelineWindow, "paginate").mockResolvedValue(false);
            vi.spyOn((vm as any).timelineWindow, "canPaginate").mockImplementation(
                (...args: unknown[]) => args[0] === Direction.Backward,
            );

            vm.onStartReached();

            await vi.waitFor(() => expect(paginate).toHaveBeenCalledWith(Direction.Backward, expect.any(Number)));
        });

        it("does not ask for older messages once the start of the room is loaded", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const paginate = vi.spyOn((vm as any).timelineWindow, "paginate").mockResolvedValue(false);
            vi.spyOn((vm as any).timelineWindow, "canPaginate").mockReturnValue(false);

            vm.onStartReached();

            expect(paginate).not.toHaveBeenCalled();
        });

        it("shows a loading spinner in the list while older messages are fetched", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            let resolvePaginate: (v: boolean) => void = () => {};
            vi.spyOn((vm as any).timelineWindow, "paginate").mockReturnValue(
                new Promise<boolean>((resolve) => {
                    resolvePaginate = resolve;
                }),
            );
            vi.spyOn((vm as any).timelineWindow, "canPaginate").mockImplementation(
                (...args: unknown[]) => args[0] === Direction.Backward,
            );

            vm.onStartReached();

            // The spinner is a real list item so it reserves scroll space.
            await vi.waitFor(() => expect(kinds(vm.getSnapshot().items)).toContain("loading"));
            resolvePaginate(false);
        });
    });

    describe("pagination (continued)", () => {
        /** Point the window's paginate/canPaginate at test doubles. */
        const stubWindow = (
            vm: RoomTimelineViewModel,
            opts: { canPaginate: Direction[]; paginate?: () => Promise<boolean> },
        ): { paginate: ReturnType<typeof vi.fn> } => {
            const tw = (vm as any).timelineWindow;
            const paginate = vi.fn(opts.paginate ?? (() => Promise.resolve(false)));
            vi.spyOn(tw, "paginate").mockImplementation(paginate);
            vi.spyOn(tw, "canPaginate").mockImplementation((...args: unknown[]) =>
                opts.canPaginate.includes(args[0] as Direction),
            );
            return { paginate };
        };

        it("asks for newer messages when the bottom of the list is reached", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const { paginate } = stubWindow(vm, { canPaginate: [Direction.Forward] });

            vm.onEndReached();

            await vi.waitFor(() => expect(paginate).toHaveBeenCalledWith(Direction.Forward, expect.any(Number)));
        });

        it("does not ask for newer messages once the latest is loaded", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const { paginate } = stubWindow(vm, { canPaginate: [] });

            vm.onEndReached();

            expect(paginate).not.toHaveBeenCalled();
        });

        it("clears the spinner when fetching fails", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            stubWindow(vm, {
                canPaginate: [Direction.Backward],
                paginate: () => Promise.reject(new Error("network went away")),
            });

            vm.onStartReached();

            // The failure must not leave a spinner stuck in the list forever.
            await vi.waitFor(() => expect(kinds(vm.getSnapshot().items)).not.toContain("loading"));
        });

        it("waits for a fetched message to decrypt before showing it", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();

            const tw = (vm as any).timelineWindow;
            const existing = tw.getEvents();
            const { event: encrypted, decrypt } = makeEncryptedPending("$enc");
            let fetched = false;
            vi.spyOn(tw, "canPaginate").mockImplementation((...a: unknown[]) => a[0] === Direction.Backward);
            vi.spyOn(tw, "paginate").mockImplementation(async () => {
                fetched = true;
                return false;
            });
            vi.spyOn(tw, "getEvents").mockImplementation(() => (fetched ? [encrypted, ...existing] : existing));

            vm.onStartReached();
            // Let the fetch land, then decrypt while the view model is still waiting on it.
            await vi.waitFor(() => expect(fetched).toBe(true));
            decrypt();

            await vi.waitFor(() => expect(eventKeys(vm.getSnapshot().items)).toContain("$enc"));
        });
    });

    describe("scroll reporting", () => {
        it("clears the pending anchor once the view reports it has arrived", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel("$a");
            expect(vm.getSnapshot().pendingAnchor).not.toBeNull();

            vm.onAnchorReached();

            expect(vm.getSnapshot().pendingAnchor).toBeNull();
        });

        it("tracks whether the view is scrolled to the bottom", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();

            vm.onAtBottomStateChange(true);
            expect(vm.getSnapshot().isAtBottom).toBe(true);

            vm.onAtBottomStateChange(false);
            expect(vm.getSnapshot().isAtBottom).toBe(false);
        });
    });

    describe("jumping to the latest message", () => {
        it("scrolls straight there when the newest message is already loaded", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const scrollNow = vi.fn();

            vm.onJumpToLive(scrollNow);

            // Already at the live end, so no reload is needed — scroll immediately.
            expect(scrollNow).toHaveBeenCalledWith({ targetKey: "$b", align: "end" });
        });
    });

    describe("read marker", () => {
        it("offers a jump when there are unread messages below the viewport", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);
            room.addAccountData([
                new MatrixEvent({
                    type: EventType.FullyRead,
                    room_id: ROOM_ID,
                    content: { event_id: "$a" },
                }),
            ]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();

            // Viewport sitting on the first row only, so the marker is below it.
            vm.onVisibleRangeChanged(0, 0);

            expect(vm.getSnapshot().canJumpToReadMarker).toBe("below");
        });

        it("scrolls straight to the marker when it is already loaded", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);
            room.addAccountData([
                new MatrixEvent({
                    type: EventType.FullyRead,
                    room_id: ROOM_ID,
                    content: { event_id: "$b" },
                }),
            ]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const scrollNow = vi.fn();

            vm.onJumpToReadMarker(scrollNow);

            expect(scrollNow).toHaveBeenCalledWith(expect.objectContaining({ targetKey: "read-marker" }));
        });

        it("offers a jump when the marker is older than the loaded messages", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            room.addAccountData([
                new MatrixEvent({ type: EventType.FullyRead, room_id: ROOM_ID, content: { event_id: "$gone" } }),
            ]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            // The marker is not among the loaded messages, and there is older history behind us.
            const tw = (vm as any).timelineWindow;
            vi.spyOn(tw, "canPaginate").mockImplementation((...a: unknown[]) => a[0] === Direction.Backward);

            vm.onVisibleRangeChanged(0, vm.getSnapshot().items.length - 1);

            expect(vm.getSnapshot().canJumpToReadMarker).toBe("above");
        });

        it("reloads the timeline when the marker is not loaded", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            room.addAccountData([
                new MatrixEvent({ type: EventType.FullyRead, room_id: ROOM_ID, content: { event_id: "$b" } }),
            ]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            // Marker exists but its row is not in the list, so it cannot simply be scrolled to.
            (vm as any).baseItems = [];
            (vm as any).republish("test");
            const scrollNow = vi.fn();

            vm.onJumpToReadMarker(scrollNow);

            // Falls back to fetching around the marker rather than scrolling nowhere.
            expect(scrollNow).not.toHaveBeenCalled();
        });

        it("removes the marker when everything is marked as read", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            room.addAccountData([
                new MatrixEvent({
                    type: EventType.FullyRead,
                    room_id: ROOM_ID,
                    content: { event_id: "$a" },
                }),
            ]);
            const vm = await createStartedViewModel();
            expect(kinds(vm.getSnapshot().items)).toContain("read-marker");

            vm.onMarkAllAsRead();

            await vi.waitFor(() => expect(kinds(vm.getSnapshot().items)).not.toContain("read-marker"));
        });
    });

    describe("decryption", () => {
        it("holds back a message that has not decrypted yet", async () => {
            const { event } = makeEncryptedPending("$enc");
            seedTimeline([makeMessage("$a"), event]);

            const vm = await createStartedViewModel();

            expect(eventKeys(vm.getSnapshot().items)).not.toContain("$enc");
        });

        it("shows it once it decrypts, without needing a scroll or a new message", async () => {
            const { event, decrypt } = makeEncryptedPending("$enc");
            seedTimeline([makeMessage("$a"), event]);
            const vm = await createStartedViewModel();
            expect(eventKeys(vm.getSnapshot().items)).not.toContain("$enc");

            decrypt();

            await vi.waitFor(() => expect(eventKeys(vm.getSnapshot().items)).toContain("$enc"));
        });

        it("shows a message that failed to decrypt rather than hiding it", async () => {
            // A failure may never resolve, so hiding it would silently drop the message.
            const failed = makeMessage("$utd");
            vi.spyOn(failed, "getWireType").mockReturnValue(EventType.RoomMessageEncrypted);
            vi.spyOn(failed, "isEncrypted").mockReturnValue(true);
            vi.spyOn(failed, "isDecryptionFailure").mockReturnValue(true);
            seedTimeline([makeMessage("$a"), failed]);

            const vm = await createStartedViewModel();

            expect(eventKeys(vm.getSnapshot().items)).toContain("$utd");
        });

        it("ignores decryption of a message outside the loaded window", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            const before = vm.getSnapshot().items;

            const stranger = makeMessage("$elsewhere");
            client.emit(MatrixEventEvent.Decrypted, stranger);

            expect(vm.getSnapshot().items).toBe(before);
        });
    });

    describe("read receipts", () => {
        const flushReceiptDebounce = async (): Promise<void> => {
            await vi.waitFor(() => expect(client.sendReadReceipt).toHaveBeenCalled(), { timeout: 2000 });
        };

        it("sends a receipt for the bottommost visible message", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();

            vm.onVisibleRangeChanged(0, vm.getSnapshot().items.length - 1);

            await flushReceiptDebounce();
            const [receiptedEvent, receiptType] = vi.mocked(client.sendReadReceipt).mock.calls[0];
            expect(receiptedEvent?.getId()).toBe("$b");
            expect(receiptType).toBe(ReceiptType.Read);
        });

        it("sends a private receipt when the user has read receipts turned off", async () => {
            vi.mocked(SettingsStore).getValue.mockImplementation((key): any => {
                if (key === "sendReadReceipts") return false;
                if (key === "showHiddenEventsInTimeline") return false;
                return undefined;
            });
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();

            vm.onVisibleRangeChanged(0, vm.getSnapshot().items.length - 1);

            await flushReceiptDebounce();
            expect(client.sendReadReceipt).toHaveBeenCalledWith(expect.anything(), ReceiptType.ReadPrivate);
        });

        it("does not move the receipt backwards when the user scrolls up", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            const items = vm.getSnapshot().items;

            vm.onVisibleRangeChanged(0, items.length - 1);
            await flushReceiptDebounce();
            const callsAfterBottom = vi.mocked(client.sendReadReceipt).mock.calls.length;

            // Scroll back up: the bottommost visible message is now an older one.
            vm.onVisibleRangeChanged(0, 0);
            await new Promise((r) => setTimeout(r, 700));

            expect(vi.mocked(client.sendReadReceipt).mock.calls.length).toBe(callsAfterBottom);
        });
    });

    describe("dispose", () => {
        it("stops listening to the room", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            const before = room.listenerCount(RoomEvent.Timeline);

            vm.dispose();

            expect(room.listenerCount(RoomEvent.Timeline)).toBeLessThan(before);
        });

        it("remembers where the reader got to, so the next visit resumes there", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b"), makeMessage("$c")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            vm.onAtBottomStateChange(false);
            vm.onVisibleRangeChanged(0, indexOfKey(vm.getSnapshot().items, "$b"));

            vm.dispose();

            expect(localStorage.getItem(`timeline_scroll_${ROOM_ID}`)).toBe("$b");
        });

        it("forgets the position when the reader was already at the bottom", async () => {
            localStorage.setItem(`timeline_scroll_${ROOM_ID}`, "$a");
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            vm.onVisibleRangeChanged(0, vm.getSnapshot().items.length - 1);
            vm.onAtBottomStateChange(true);

            vm.dispose();

            // Nothing saved means the next visit starts at the newest message.
            expect(localStorage.getItem(`timeline_scroll_${ROOM_ID}`)).toBeNull();
        });

        it("moves the unread marker to what the reader actually saw", async () => {
            seedTimeline([makeMessage("$a"), makeMessage("$b")]);
            const vm = await createStartedViewModel();
            vm.onAnchorReached();
            vm.onVisibleRangeChanged(0, indexOfKey(vm.getSnapshot().items, "$b"));

            vm.dispose();

            expect(client.setRoomReadMarkers).toHaveBeenCalledWith(ROOM_ID, "$b");
        });

        it("leaves a saved position alone when nothing was ever visible", async () => {
            localStorage.setItem(`timeline_scroll_${ROOM_ID}`, "$a");
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();

            vm.dispose();

            expect(localStorage.getItem(`timeline_scroll_${ROOM_ID}`)).toBe("$a");
        });

        it("ignores late events that arrive after disposal", async () => {
            seedTimeline([makeMessage("$a")]);
            const vm = await createStartedViewModel();
            vm.dispose();
            const itemsAtDispose = vm.getSnapshot().items;

            const late = makeMessage("$late");
            room.getUnfilteredTimelineSet().addLiveEvent(late, { addToState: false });
            room.emit(RoomEvent.Timeline, late, room, false, false, {
                timeline: room.getLiveTimeline(),
                liveEvent: true,
            } as any);

            expect(vm.getSnapshot().items).toBe(itemsAtDispose);
        });
    });
});
