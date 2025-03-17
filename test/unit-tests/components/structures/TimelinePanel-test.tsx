/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, waitFor, screen, act, cleanup } from "jest-matrix-react";
import {
    ReceiptType,
    EventTimelineSet,
    EventType,
    type MatrixClient,
    MatrixEvent,
    PendingEventOrdering,
    RelationType,
    Room,
    RoomEvent,
    RoomMember,
    RoomState,
    TimelineWindow,
    EventTimeline,
    FeatureSupport,
    Thread,
    THREAD_RELATION_TYPE,
    ThreadEvent,
    ThreadFilterType,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import React from "react";
import { type Mocked, mocked } from "jest-mock";
import { forEachRight } from "lodash";

import TimelinePanel from "../../../../src/components/structures/TimelinePanel";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { isCallEvent } from "../../../../src/components/structures/LegacyCallEventGrouper";
import { filterConsole, flushPromises, mkMembership, mkRoom, stubClient } from "../../../test-utils";
import { mkThread } from "../../../test-utils/threads";
import { createMessageEventContent } from "../../../test-utils/events";
import SettingsStore from "../../../../src/settings/SettingsStore";
import ScrollPanel from "../../../../src/components/structures/ScrollPanel";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";

// ScrollPanel calls this, but jsdom doesn't mock it for us
HTMLDivElement.prototype.scrollBy = () => {};

const newReceipt = (eventId: string, userId: string, readTs: number, fullyReadTs: number): MatrixEvent => {
    const receiptContent = {
        [eventId]: {
            [ReceiptType.Read]: { [userId]: { ts: readTs } },
            [ReceiptType.ReadPrivate]: { [userId]: { ts: readTs } },
            [ReceiptType.FullyRead]: { [userId]: { ts: fullyReadTs } },
        },
    };
    return new MatrixEvent({ content: receiptContent, type: EventType.Receipt });
};

const mkTimeline = (room: Room, events: MatrixEvent[]): [EventTimeline, EventTimelineSet] => {
    const timelineSet = {
        room: room as Room,
        getLiveTimeline: () => timeline,
        getTimelineForEvent: () => timeline,
        getPendingEvents: () => [] as MatrixEvent[],
    } as unknown as EventTimelineSet;
    const timeline = new EventTimeline(timelineSet);
    events.forEach((event) => timeline.addEvent(event, { toStartOfTimeline: false, addToState: true }));

    return [timeline, timelineSet];
};

const getProps = (room: Room, events: MatrixEvent[]): TimelinePanel["props"] => {
    const [, timelineSet] = mkTimeline(room, events);

    return {
        timelineSet,
        manageReadReceipts: true,
        sendReadReceiptOnLoad: true,
    };
};

const mockEvents = (room: Room, count = 2): MatrixEvent[] => {
    const events: MatrixEvent[] = [];
    for (let index = 0; index < count; index++) {
        const event = new MatrixEvent({
            room_id: room.roomId,
            event_id: `${room.roomId}_event_${index}`,
            type: EventType.RoomMessage,
            sender: "userId",
            content: createMessageEventContent("`Event${index}`"),
            origin_server_ts: index,
        });
        event.localTimestamp = index;
        events.push(event);
    }

    return events;
};

const setupTestData = (): [MatrixClient, Room, MatrixEvent[]] => {
    const client = MatrixClientPeg.safeGet();
    const room = mkRoom(client, "roomId");
    const events = mockEvents(room);
    return [client, room, events];
};

const setupOverlayTestData = (client: MatrixClient, mainEvents: MatrixEvent[]): [Room, MatrixEvent[]] => {
    const virtualRoom = mkRoom(client, "virtualRoomId");
    const overlayEvents = mockEvents(virtualRoom, 5);

    // Set the event order that we'll be looking for in the timeline
    overlayEvents[0].localTimestamp = 1000;
    mainEvents[0].localTimestamp = 2000;
    overlayEvents[1].localTimestamp = 3000;
    overlayEvents[2].localTimestamp = 4000;
    overlayEvents[3].localTimestamp = 5000;
    mainEvents[1].localTimestamp = 6000;
    overlayEvents[4].localTimestamp = 7000;

    return [virtualRoom, overlayEvents];
};

const expectEvents = (container: HTMLElement, events: MatrixEvent[]): void => {
    const eventTiles = container.querySelectorAll(".mx_EventTile");
    const eventTileIds = [...eventTiles].map((tileElement) => tileElement.getAttribute("data-event-id"));
    expect(eventTileIds).toEqual(events.map((ev) => ev.getId()));
};

const withScrollPanelMountSpy = async (
    continuation: (mountSpy: jest.SpyInstance<void, []>) => Promise<void>,
): Promise<void> => {
    const mountSpy = jest.spyOn(ScrollPanel.prototype, "componentDidMount");
    try {
        await continuation(mountSpy);
    } finally {
        mountSpy.mockRestore();
    }
};

const setupPagination = (
    client: MatrixClient,
    timeline: EventTimeline,
    previousPage: MatrixEvent[] | null,
    nextPage: MatrixEvent[] | null,
): void => {
    timeline.setPaginationToken(previousPage === null ? null : "start", EventTimeline.BACKWARDS);
    timeline.setPaginationToken(nextPage === null ? null : "end", EventTimeline.FORWARDS);
    mocked(client).paginateEventTimeline.mockImplementation(async (tl, { backwards }) => {
        if (tl === timeline) {
            if (backwards) {
                forEachRight(previousPage ?? [], (event) =>
                    tl.addEvent(event, { toStartOfTimeline: true, addToState: true }),
                );
            } else {
                (nextPage ?? []).forEach((event) => tl.addEvent(event, { toStartOfTimeline: false, addToState: true }));
            }
            // Prevent any further pagination attempts in this direction
            tl.setPaginationToken(null, backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS);
            return true;
        } else {
            return false;
        }
    });
};

describe("TimelinePanel", () => {
    let client: Mocked<MatrixClient>;
    let userId: string;

    filterConsole("checkForPreJoinUISI: showing all messages, skipping check");

    beforeEach(() => {
        client = mocked(stubClient());
        userId = client.getSafeUserId();
    });

    describe("read receipts and markers", () => {
        const roomId = "#room:example.com";
        let room: Room;
        let timelineSet: EventTimelineSet;
        let timelinePanel: TimelinePanel | null = null;

        const ev1 = new MatrixEvent({
            event_id: "ev1",
            sender: "@u2:m.org",
            origin_server_ts: 111,
            type: EventType.RoomMessage,
            content: createMessageEventContent("hello 1"),
        });

        const ev2 = new MatrixEvent({
            event_id: "ev2",
            sender: "@u2:m.org",
            origin_server_ts: 222,
            type: EventType.RoomMessage,
            content: createMessageEventContent("hello 2"),
        });

        const renderTimelinePanel = async (): Promise<void> => {
            render(
                <TimelinePanel
                    timelineSet={timelineSet}
                    manageReadMarkers={true}
                    manageReadReceipts={true}
                    ref={(ref) => (timelinePanel = ref)}
                />,
            );
            await flushPromises();
            await waitFor(() => expect(timelinePanel).toBeTruthy());
        };

        const setUpTimelineSet = (threadRoot?: MatrixEvent) => {
            let thread: Thread | undefined = undefined;

            if (threadRoot) {
                thread = new Thread(threadRoot.getId()!, threadRoot, {
                    client: client,
                    room,
                });
            }

            timelineSet = new EventTimelineSet(room, {}, client, thread);
            timelineSet.on(RoomEvent.Timeline, (...args) => {
                // TimelinePanel listens for live events on the client.
                // → Re-emit on the client.
                client.emit(RoomEvent.Timeline, ...args);
            });
        };

        beforeEach(() => {
            room = new Room(roomId, client, userId, { pendingEventOrdering: PendingEventOrdering.Detached });
        });

        afterEach(async () => {
            TimelinePanel.roomReadMarkerTsMap = {};
            cleanup();
        });

        it("when there is no event, it should not send any receipt", async () => {
            setUpTimelineSet();
            await renderTimelinePanel();
            await flushPromises();

            // @ts-ignore
            await timelinePanel.sendReadReceipts();

            expect(client.setRoomReadMarkers).not.toHaveBeenCalled();
            expect(client.sendReadReceipt).not.toHaveBeenCalled();
        });

        describe("when there is a non-threaded timeline", () => {
            beforeEach(() => {
                setUpTimelineSet();
            });

            describe("and reading the timeline", () => {
                beforeEach(async () => {
                    await renderTimelinePanel();
                    timelineSet.addLiveEvent(ev1, { addToState: true });
                    await flushPromises();
                    // @ts-ignore
                    await timelinePanel.sendReadReceipts();
                    // @ts-ignore Simulate user activity by calling updateReadMarker on the TimelinePanel.
                    await timelinePanel.updateReadMarker();
                });

                it("should send a fully read marker and a public receipt", async () => {
                    expect(client.setRoomReadMarkers).toHaveBeenCalledWith(roomId, ev1.getId());
                    expect(client.sendReadReceipt).toHaveBeenCalledWith(ev1, ReceiptType.Read);
                });

                describe("and reading the timeline again", () => {
                    beforeEach(async () => {
                        client.sendReadReceipt.mockClear();
                        client.setRoomReadMarkers.mockClear();

                        // @ts-ignore Simulate user activity by calling updateReadMarker on the TimelinePanel.
                        await act(() => timelinePanel.updateReadMarker());
                    });

                    it("should not send receipts again", () => {
                        expect(client.sendReadReceipt).not.toHaveBeenCalled();
                        expect(client.setRoomReadMarkers).not.toHaveBeenCalled();
                    });

                    it("and forgetting the read markers, should send the stored marker again", async () => {
                        timelineSet.addLiveEvent(ev2, { addToState: true });
                        // Add the event to the room as well as the timeline, so we can find it when we
                        // call findEventById in getEventReadUpTo. This is odd because in our test
                        // setup, timelineSet is not actually the timelineSet of the room.
                        await room.addLiveEvents([ev2], { addToState: true });
                        room.addEphemeralEvents([newReceipt(ev2.getId()!, userId, 222, 200)]);
                        await timelinePanel!.forgetReadMarker();
                        expect(client.setRoomReadMarkers).toHaveBeenCalledWith(roomId, ev2.getId());
                    });
                });
            });

            describe("and sending receipts is disabled", () => {
                beforeEach(async () => {
                    client.isVersionSupported.mockResolvedValue(true);
                    client.doesServerSupportUnstableFeature.mockResolvedValue(true);

                    jest.spyOn(SettingsStore, "getValue").mockImplementation((setting: string): any => {
                        if (setting === "sendReadReceipts") return false;

                        return undefined;
                    });
                });

                afterEach(() => {
                    mocked(SettingsStore.getValue).mockReset();
                });

                it("should send a fully read marker and a private receipt", async () => {
                    await renderTimelinePanel();
                    act(() => timelineSet.addLiveEvent(ev1, { addToState: true }));
                    await flushPromises();

                    // @ts-ignore
                    await timelinePanel.sendReadReceipts();

                    // Expect the private reception to be sent directly
                    expect(client.sendReadReceipt).toHaveBeenCalledWith(ev1, ReceiptType.ReadPrivate);
                    // Expect the fully_read marker not to be send yet
                    expect(client.setRoomReadMarkers).not.toHaveBeenCalled();

                    await flushPromises();
                    client.sendReadReceipt.mockClear();

                    // @ts-ignore simulate user activity
                    await timelinePanel.updateReadMarker();

                    // It should not send the receipt again.
                    expect(client.sendReadReceipt).not.toHaveBeenCalledWith(ev1, ReceiptType.ReadPrivate);
                    // Expect the fully_read marker to be sent after user activity.
                    await waitFor(() => expect(client.setRoomReadMarkers).toHaveBeenCalledWith(roomId, ev1.getId()));
                });
            });
        });

        describe("and there is a thread timeline", () => {
            const threadEv1 = new MatrixEvent({
                event_id: "thread_ev1",
                sender: "@u2:m.org",
                origin_server_ts: 222,
                type: EventType.RoomMessage,
                content: {
                    ...createMessageEventContent("hello 2"),
                    "m.relates_to": {
                        event_id: ev1.getId(),
                        rel_type: RelationType.Thread,
                    },
                },
            });

            beforeEach(() => {
                client.supportsThreads.mockReturnValue(true);
                setUpTimelineSet(ev1);
            });

            it("should send receipts but no fully_read when reading the thread timeline", async () => {
                await renderTimelinePanel();
                act(() => timelineSet.addLiveEvent(threadEv1, { addToState: true }));
                await flushPromises();

                // @ts-ignore
                await act(() => timelinePanel.sendReadReceipts());

                // fully_read is not supported for threads per spec
                expect(client.setRoomReadMarkers).not.toHaveBeenCalled();
                expect(client.sendReadReceipt).toHaveBeenCalledWith(threadEv1, ReceiptType.Read);
            });
        });
    });

    it("should scroll event into view when props.eventId changes", () => {
        const client = MatrixClientPeg.safeGet();
        const room = mkRoom(client, "roomId");
        const events = mockEvents(room);

        const props = {
            ...getProps(room, events),
            onEventScrolledIntoView: jest.fn(),
        };

        const { rerender } = render(<TimelinePanel {...props} />);
        expect(props.onEventScrolledIntoView).toHaveBeenCalledWith(undefined);
        props.eventId = events[1].getId();
        rerender(<TimelinePanel {...props} />);
        expect(props.onEventScrolledIntoView).toHaveBeenCalledWith(events[1].getId());
    });

    it("paginates", async () => {
        const [client, room, events] = setupTestData();
        const eventsPage1 = events.slice(0, 1);
        const eventsPage2 = events.slice(1, 2);

        // Start with only page 2 of the main events in the window
        const [timeline, timelineSet] = mkTimeline(room, eventsPage2);
        setupPagination(client, timeline, eventsPage1, null);

        await withScrollPanelMountSpy(async (mountSpy) => {
            const { container } = render(<TimelinePanel {...getProps(room, events)} timelineSet={timelineSet} />);

            await waitFor(() => expectEvents(container, [events[1]]));

            // ScrollPanel has no chance of working in jsdom, so we've no choice
            // but to do some shady stuff to trigger the fill callback by hand
            const scrollPanel = mountSpy.mock.contexts[0] as ScrollPanel;
            scrollPanel.props.onFillRequest!(true);

            await waitFor(() => expectEvents(container, [events[0], events[1]]));
        });
    });

    it("unpaginates", async () => {
        const [, room, events] = setupTestData();

        await withScrollPanelMountSpy(async (mountSpy) => {
            const { container } = render(<TimelinePanel {...getProps(room, events)} />);

            await waitFor(() => expectEvents(container, [events[0], events[1]]));

            // ScrollPanel has no chance of working in jsdom, so we've no choice
            // but to do some shady stuff to trigger the unfill callback by hand
            const scrollPanel = mountSpy.mock.contexts[0] as ScrollPanel;
            scrollPanel.props.onUnfillRequest!(true, events[0].getId()!);

            await waitFor(() => expectEvents(container, [events[1]]));
        });
    });

    describe("onRoomTimeline", () => {
        it("ignores events for other timelines", () => {
            const [client, room, events] = setupTestData();

            const otherTimelineSet = { room: room as Room } as EventTimelineSet;
            const otherTimeline = new EventTimeline(otherTimelineSet);

            const props = {
                ...getProps(room, events),
                onEventScrolledIntoView: jest.fn(),
            };

            const paginateSpy = jest.spyOn(TimelineWindow.prototype, "paginate").mockClear();

            render(<TimelinePanel {...props} />);

            const event = new MatrixEvent({ type: RoomEvent.Timeline, origin_server_ts: 0 });
            const data = { timeline: otherTimeline, liveEvent: true };
            client.emit(RoomEvent.Timeline, event, room, false, false, data);

            expect(paginateSpy).not.toHaveBeenCalled();
        });

        it("ignores timeline updates without a live event", () => {
            const [client, room, events] = setupTestData();

            const props = getProps(room, events);

            const paginateSpy = jest.spyOn(TimelineWindow.prototype, "paginate").mockClear();

            render(<TimelinePanel {...props} />);

            const event = new MatrixEvent({ type: RoomEvent.Timeline, origin_server_ts: 0 });
            const data = { timeline: props.timelineSet.getLiveTimeline(), liveEvent: false };
            client.emit(RoomEvent.Timeline, event, room, false, false, data);

            expect(paginateSpy).not.toHaveBeenCalled();
        });

        it("ignores timeline where toStartOfTimeline is true", () => {
            const [client, room, events] = setupTestData();

            const props = getProps(room, events);

            const paginateSpy = jest.spyOn(TimelineWindow.prototype, "paginate").mockClear();

            render(<TimelinePanel {...props} />);

            const event = new MatrixEvent({ type: RoomEvent.Timeline, origin_server_ts: 0 });
            const data = { timeline: props.timelineSet.getLiveTimeline(), liveEvent: false };
            const toStartOfTimeline = true;
            client.emit(RoomEvent.Timeline, event, room, toStartOfTimeline, false, data);

            expect(paginateSpy).not.toHaveBeenCalled();
        });

        it("advances the timeline window", () => {
            const [client, room, events] = setupTestData();

            const props = getProps(room, events);

            const paginateSpy = jest.spyOn(TimelineWindow.prototype, "paginate").mockClear();

            render(<TimelinePanel {...props} />);

            const event = new MatrixEvent({ type: RoomEvent.Timeline, origin_server_ts: 0 });
            const data = { timeline: props.timelineSet.getLiveTimeline(), liveEvent: true };
            client.emit(RoomEvent.Timeline, event, room, false, false, data);

            expect(paginateSpy).toHaveBeenCalledWith(EventTimeline.FORWARDS, 1, false);
        });

        it("advances the overlay timeline window", async () => {
            const [client, room, events] = setupTestData();

            const virtualRoom = mkRoom(client, "virtualRoomId");
            const virtualEvents = mockEvents(virtualRoom);
            const { timelineSet: overlayTimelineSet } = getProps(virtualRoom, virtualEvents);

            const props = {
                ...getProps(room, events),
                overlayTimelineSet,
            };

            const paginateSpy = jest.spyOn(TimelineWindow.prototype, "paginate").mockClear();

            render(<TimelinePanel {...props} />);

            await flushPromises();

            const event = new MatrixEvent({ type: RoomEvent.Timeline, origin_server_ts: 0 });
            const data = { timeline: props.timelineSet.getLiveTimeline(), liveEvent: true };
            client.emit(RoomEvent.Timeline, event, room, false, false, data);

            await flushPromises();

            expect(paginateSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("with overlayTimeline", () => {
        it("renders merged timeline", async () => {
            const [client, room, events] = setupTestData();
            const virtualRoom = mkRoom(client, "virtualRoomId");
            const virtualCallInvite = new MatrixEvent({
                type: "m.call.invite",
                room_id: virtualRoom.roomId,
                event_id: `virtualCallEvent1`,
                origin_server_ts: 0,
            });
            virtualCallInvite.localTimestamp = 2;
            const virtualCallMetaEvent = new MatrixEvent({
                type: "org.matrix.call.sdp_stream_metadata_changed",
                room_id: virtualRoom.roomId,
                event_id: `virtualCallEvent2`,
                origin_server_ts: 0,
            });
            virtualCallMetaEvent.localTimestamp = 2;
            const virtualEvents = [virtualCallInvite, ...mockEvents(virtualRoom), virtualCallMetaEvent];
            const { timelineSet: overlayTimelineSet } = getProps(virtualRoom, virtualEvents);

            const { container } = render(
                <TimelinePanel
                    {...getProps(room, events)}
                    overlayTimelineSet={overlayTimelineSet}
                    overlayTimelineSetFilter={isCallEvent}
                />,
            );
            await waitFor(() =>
                expectEvents(container, [
                    // main timeline events are included
                    events[0],
                    events[1],
                    // virtual timeline call event is included
                    virtualCallInvite,
                    // virtual call event has no tile renderer => not rendered
                ]),
            );
        });

        it.each([
            ["when it starts with no overlay events", true],
            ["to get enough overlay events", false],
        ])("expands the initial window %s", async (_s, startWithEmptyOverlayWindow) => {
            const [client, room, events] = setupTestData();
            const [virtualRoom, overlayEvents] = setupOverlayTestData(client, events);

            let overlayEventsPage1: MatrixEvent[];
            let overlayEventsPage2: MatrixEvent[];
            let overlayEventsPage3: MatrixEvent[];
            if (startWithEmptyOverlayWindow) {
                overlayEventsPage1 = overlayEvents.slice(0, 3);
                overlayEventsPage2 = [];
                overlayEventsPage3 = overlayEvents.slice(3, 5);
            } else {
                overlayEventsPage1 = overlayEvents.slice(0, 2);
                overlayEventsPage2 = overlayEvents.slice(2, 3);
                overlayEventsPage3 = overlayEvents.slice(3, 5);
            }

            // Start with only page 2 of the overlay events in the window
            const [overlayTimeline, overlayTimelineSet] = mkTimeline(virtualRoom, overlayEventsPage2);
            setupPagination(client, overlayTimeline, overlayEventsPage1, overlayEventsPage3);

            const { container } = render(
                <TimelinePanel {...getProps(room, events)} overlayTimelineSet={overlayTimelineSet} />,
            );

            await waitFor(() =>
                expectEvents(container, [
                    overlayEvents[0],
                    events[0],
                    overlayEvents[1],
                    overlayEvents[2],
                    overlayEvents[3],
                    events[1],
                    overlayEvents[4],
                ]),
            );
        });

        it("extends overlay window beyond main window at the start of the timeline", async () => {
            const [client, room, events] = setupTestData();
            const [virtualRoom, overlayEvents] = setupOverlayTestData(client, events);
            // Delete event 0 so the TimelinePanel will still leave some stuff
            // unloaded for us to test with
            events.shift();

            const overlayEventsPage1 = overlayEvents.slice(0, 2);
            const overlayEventsPage2 = overlayEvents.slice(2, 5);

            // Start with only page 2 of the overlay events in the window
            const [overlayTimeline, overlayTimelineSet] = mkTimeline(virtualRoom, overlayEventsPage2);
            setupPagination(client, overlayTimeline, overlayEventsPage1, null);

            const { container } = render(
                <TimelinePanel {...getProps(room, events)} overlayTimelineSet={overlayTimelineSet} />,
            );

            await waitFor(() =>
                expectEvents(container, [
                    // These first two are the newly loaded events
                    overlayEvents[0],
                    overlayEvents[1],
                    overlayEvents[2],
                    overlayEvents[3],
                    events[0],
                    overlayEvents[4],
                ]),
            );
        });

        it("extends overlay window beyond main window at the end of the timeline", async () => {
            const [client, room, events] = setupTestData();
            const [virtualRoom, overlayEvents] = setupOverlayTestData(client, events);
            // Delete event 1 so the TimelinePanel will still leave some stuff
            // unloaded for us to test with
            events.pop();

            const overlayEventsPage1 = overlayEvents.slice(0, 2);
            const overlayEventsPage2 = overlayEvents.slice(2, 5);

            // Start with only page 1 of the overlay events in the window
            const [overlayTimeline, overlayTimelineSet] = mkTimeline(virtualRoom, overlayEventsPage1);
            setupPagination(client, overlayTimeline, null, overlayEventsPage2);

            const { container } = render(
                <TimelinePanel {...getProps(room, events)} overlayTimelineSet={overlayTimelineSet} />,
            );

            await waitFor(() =>
                expectEvents(container, [
                    overlayEvents[0],
                    events[0],
                    overlayEvents[1],
                    // These are the newly loaded events
                    overlayEvents[2],
                    overlayEvents[3],
                    overlayEvents[4],
                ]),
            );
        });

        it("paginates", async () => {
            const [client, room, events] = setupTestData();
            const [virtualRoom, overlayEvents] = setupOverlayTestData(client, events);

            const eventsPage1 = events.slice(0, 1);
            const eventsPage2 = events.slice(1, 2);

            // Start with only page 1 of the main events in the window
            const [timeline, timelineSet] = mkTimeline(room, eventsPage1);
            const [, overlayTimelineSet] = mkTimeline(virtualRoom, overlayEvents);
            setupPagination(client, timeline, null, eventsPage2);

            await withScrollPanelMountSpy(async (mountSpy) => {
                const { container } = render(
                    <TimelinePanel
                        {...getProps(room, events)}
                        timelineSet={timelineSet}
                        overlayTimelineSet={overlayTimelineSet}
                    />,
                );

                await waitFor(() => expectEvents(container, [overlayEvents[0], events[0]]));

                // ScrollPanel has no chance of working in jsdom, so we've no choice
                // but to do some shady stuff to trigger the fill callback by hand
                const scrollPanel = mountSpy.mock.contexts[0] as ScrollPanel;
                scrollPanel.props.onFillRequest!(false);

                await waitFor(() =>
                    expectEvents(container, [
                        overlayEvents[0],
                        events[0],
                        overlayEvents[1],
                        overlayEvents[2],
                        overlayEvents[3],
                        events[1],
                        overlayEvents[4],
                    ]),
                );
            });
        });

        it.each([
            ["down", "main", true, false],
            ["down", "overlay", true, true],
            ["up", "main", false, false],
            ["up", "overlay", false, true],
        ])("unpaginates %s to an event from the %s timeline", async (_s1, _s2, backwards, fromOverlay) => {
            const [client, room, events] = setupTestData();
            const [virtualRoom, overlayEvents] = setupOverlayTestData(client, events);

            let marker: MatrixEvent;
            let expectedEvents: MatrixEvent[];
            if (backwards) {
                if (fromOverlay) {
                    marker = overlayEvents[1];
                    // Overlay events 0−1 and event 0 should be unpaginated
                    // Overlay events 2−3 should be hidden since they're at the edge of the window
                    expectedEvents = [events[1], overlayEvents[4]];
                } else {
                    marker = events[0];
                    // Overlay event 0 and event 0 should be unpaginated
                    // Overlay events 1−3 should be hidden since they're at the edge of the window
                    expectedEvents = [events[1], overlayEvents[4]];
                }
            } else {
                if (fromOverlay) {
                    marker = overlayEvents[4];
                    // Only the last overlay event should be unpaginated
                    expectedEvents = [
                        overlayEvents[0],
                        events[0],
                        overlayEvents[1],
                        overlayEvents[2],
                        overlayEvents[3],
                        events[1],
                    ];
                } else {
                    // Get rid of overlay event 4 so we can test the case where no overlay events get unpaginated
                    overlayEvents.pop();
                    marker = events[1];
                    // Only event 1 should be unpaginated
                    // Overlay events 1−2 should be hidden since they're at the edge of the window
                    expectedEvents = [overlayEvents[0], events[0]];
                }
            }

            const [, overlayTimelineSet] = mkTimeline(virtualRoom, overlayEvents);

            await withScrollPanelMountSpy(async (mountSpy) => {
                const { container } = render(
                    <TimelinePanel {...getProps(room, events)} overlayTimelineSet={overlayTimelineSet} />,
                );

                await waitFor(() =>
                    expectEvents(container, [
                        overlayEvents[0],
                        events[0],
                        overlayEvents[1],
                        overlayEvents[2],
                        overlayEvents[3],
                        events[1],
                        ...(!backwards && !fromOverlay ? [] : [overlayEvents[4]]),
                    ]),
                );

                // ScrollPanel has no chance of working in jsdom, so we've no choice
                // but to do some shady stuff to trigger the unfill callback by hand
                const scrollPanel = mountSpy.mock.contexts[0] as ScrollPanel;
                scrollPanel.props.onUnfillRequest!(backwards, marker.getId()!);

                await waitFor(() => expectEvents(container, expectedEvents));
            });
        });
    });

    describe("when a thread updates", () => {
        let client: MatrixClient;
        let room: Room;
        let allThreads: EventTimelineSet;
        let root: MatrixEvent;
        let reply1: MatrixEvent;
        let reply2: MatrixEvent;

        beforeEach(() => {
            client = MatrixClientPeg.safeGet();

            Thread.hasServerSideSupport = FeatureSupport.Stable;
            room = new Room("roomId", client, "userId", { pendingEventOrdering: PendingEventOrdering.Detached });
            allThreads = new EventTimelineSet(
                room,
                {
                    pendingEvents: false,
                },
                undefined,
                undefined,
                ThreadFilterType.All,
            );
            const timeline = new EventTimeline(allThreads);
            allThreads.getLiveTimeline = () => timeline;
            allThreads.getTimelineForEvent = () => timeline;

            reply1 = new MatrixEvent({
                room_id: room.roomId,
                event_id: "event_reply_1",
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("ReplyEvent1"),
                origin_server_ts: 0,
            });

            reply2 = new MatrixEvent({
                room_id: room.roomId,
                event_id: "event_reply_2",
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("ReplyEvent2"),
                origin_server_ts: 0,
            });

            root = new MatrixEvent({
                room_id: room.roomId,
                event_id: "event_root_1",
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("RootEvent"),
                origin_server_ts: 0,
            });

            const eventMap: { [key: string]: MatrixEvent } = {
                [root.getId()!]: root,
                [reply1.getId()!]: reply1,
                [reply2.getId()!]: reply2,
            };

            room.findEventById = (eventId: string) => eventMap[eventId];
            client.fetchRoomEvent = async (roomId: string, eventId: string) =>
                roomId === room.roomId ? eventMap[eventId]?.event : {};
        });

        it("updates thread previews", async () => {
            mocked(client.supportsThreads).mockReturnValue(true);
            reply1.getContent()["m.relates_to"] = {
                rel_type: RelationType.Thread,
                event_id: root.getId(),
            };
            reply2.getContent()["m.relates_to"] = {
                rel_type: RelationType.Thread,
                event_id: root.getId(),
            };

            const thread = room.createThread(root.getId()!, root, [], true);
            // So that we do not have to mock the thread loading
            thread.initialEventsFetched = true;
            // @ts-ignore
            thread.fetchEditsWhereNeeded = () => Promise.resolve();
            await thread.addEvent(reply1, false, true);
            await allThreads
                .getLiveTimeline()
                .addEvent(thread.rootEvent!, { toStartOfTimeline: true, addToState: true });
            const replyToEvent = jest.spyOn(thread, "replyToEvent", "get");

            const dom = render(
                <MatrixClientContext.Provider value={client}>
                    <TimelinePanel timelineSet={allThreads} manageReadReceipts sendReadReceiptOnLoad />
                </MatrixClientContext.Provider>,
            );
            await dom.findByText("RootEvent");
            await dom.findByText("ReplyEvent1");
            expect(replyToEvent).toHaveBeenCalled();

            replyToEvent.mockClear();
            await thread.addEvent(reply2, false, true);
            await dom.findByText("RootEvent");
            await dom.findByText("ReplyEvent2");
            expect(replyToEvent).toHaveBeenCalled();
        });

        it("ignores thread updates for unknown threads", async () => {
            root.setUnsigned({
                "m.relations": {
                    [THREAD_RELATION_TYPE.name]: {
                        latest_event: reply1.event,
                        count: 1,
                        current_user_participated: true,
                    },
                },
            });

            const realThread = room.createThread(root.getId()!, root, [], true);
            // So that we do not have to mock the thread loading
            realThread.initialEventsFetched = true;
            // @ts-ignore
            realThread.fetchEditsWhereNeeded = () => Promise.resolve();
            await realThread.addEvent(reply1, true);
            await allThreads
                .getLiveTimeline()
                .addEvent(realThread.rootEvent!, { toStartOfTimeline: true, addToState: true });
            const replyToEvent = jest.spyOn(realThread, "replyToEvent", "get");

            // @ts-ignore
            const fakeThread1: Thread = {
                id: undefined!,
                get roomId(): string {
                    return room.roomId;
                },
            };

            const fakeRoom = new Room("thisroomdoesnotexist", client, "userId");
            // @ts-ignore
            const fakeThread2: Thread = {
                id: root.getId()!,
                get roomId(): string {
                    return fakeRoom.roomId;
                },
            };

            const dom = render(
                <MatrixClientContext.Provider value={client}>
                    <TimelinePanel timelineSet={allThreads} manageReadReceipts sendReadReceiptOnLoad />
                </MatrixClientContext.Provider>,
            );
            await dom.findByText("RootEvent");
            await dom.findByText("ReplyEvent1");
            expect(replyToEvent).toHaveBeenCalled();

            replyToEvent.mockClear();
            room.emit(ThreadEvent.Update, fakeThread1);
            room.emit(ThreadEvent.Update, fakeThread2);
            await dom.findByText("ReplyEvent1");
            expect(replyToEvent).not.toHaveBeenCalled();
            replyToEvent.mockClear();
        });
    });

    it("renders when the last message is an undecryptable thread root", async () => {
        const client = MatrixClientPeg.safeGet();
        client.isRoomEncrypted = () => true;
        client.supportsThreads = () => true;
        client.decryptEventIfNeeded = () => Promise.resolve();
        const authorId = client.getUserId()!;
        const room = new Room("roomId", client, authorId, {
            lazyLoadMembers: false,
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const events = mockEvents(room);
        const timelineSet = room.getUnfilteredTimelineSet();

        const { rootEvent } = mkThread({
            room,
            client,
            authorId,
            participantUserIds: [authorId],
        });

        events.push(rootEvent);

        events.forEach((event) =>
            timelineSet.getLiveTimeline().addEvent(event, { toStartOfTimeline: true, addToState: true }),
        );

        const roomMembership = mkMembership({
            mship: KnownMembership.Join,
            prevMship: KnownMembership.Join,
            user: authorId,
            room: room.roomId,
            event: true,
            skey: "123",
        });

        events.push(roomMembership);

        const member = new RoomMember(room.roomId, authorId);
        member.membership = KnownMembership.Join;

        const roomState = new RoomState(room.roomId);
        jest.spyOn(roomState, "getMember").mockReturnValue(member);

        jest.spyOn(timelineSet.getLiveTimeline(), "getState").mockReturnValue(roomState);
        timelineSet.addEventToTimeline(roomMembership, timelineSet.getLiveTimeline(), {
            toStartOfTimeline: false,
            addToState: true,
        });

        for (const event of events) {
            jest.spyOn(event, "isDecryptionFailure").mockReturnValue(true);
            jest.spyOn(event, "shouldAttemptDecryption").mockReturnValue(false);
        }

        const { container } = render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanel timelineSet={timelineSet} manageReadReceipts={true} sendReadReceiptOnLoad={true} />
            </MatrixClientContext.Provider>,
        );

        await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
        await waitFor(() => expect(container.querySelector(".mx_RoomView_MessageList")).not.toBeEmptyDOMElement());
    });

    it("should dump debug logs on Action.DumpDebugLogs", async () => {
        const spy = jest.spyOn(console, "debug");

        const [, room, events] = setupTestData();
        const eventsPage2 = events.slice(1, 2);

        // Start with only page 2 of the main events in the window
        const [, timelineSet] = mkTimeline(room, eventsPage2);
        room.getTimelineSets = jest.fn().mockReturnValue([timelineSet]);

        await withScrollPanelMountSpy(async () => {
            const { container } = render(<TimelinePanel {...getProps(room, events)} timelineSet={timelineSet} />);

            await waitFor(() => expectEvents(container, [events[1]]));
        });

        act(() => defaultDispatcher.fire(Action.DumpDebugLogs));

        await waitFor(() =>
            expect(spy).toHaveBeenCalledWith(expect.stringContaining("TimelinePanel(Room): Debugging info for roomId")),
        );
    });
});
