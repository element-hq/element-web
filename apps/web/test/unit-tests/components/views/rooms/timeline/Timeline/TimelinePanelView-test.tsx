/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import { TimelinePanelView } from "../../../../../../../src/components/views/rooms/timeline/Timeline";
import { TimelinePanelViewModel } from "../../../../../../../src/viewmodels/room/timeline/TimelinePanelViewModel";

jest.mock("@element-hq/web-shared-components", () => {
    const actual = jest.requireActual("@element-hq/web-shared-components");
    return {
        ...actual,
        TimelineView: ({ vm, renderItem }: any) => (
            <div data-testid="timeline-view">{vm.getSnapshot().items.map((item: any) => renderItem(item))}</div>
        ),
        DateSeparatorView: ({ vm, className }: any) => (
            <div data-testid="date-separator" className={className}>
                separator:{vm.props.roomId}:{vm.props.ts}
            </div>
        ),
    };
});

jest.mock("../../../../../../../src/components/views/rooms/NewRoomIntro", () => ({
    __esModule: true,
    default: () => <div data-testid="new-room-intro">room creation</div>,
}));

jest.mock("../../../../../../../src/components/views/elements/GenericEventListSummary", () => ({
    __esModule: true,
    default: ({ summaryText, children }: any) => (
        <div data-testid="room-creation-group">
            <span>{summaryText}</span>
            {children}
        </div>
    ),
}));

jest.mock("../../../../../../../src/components/views/rooms/LegacyEventTileAdapter", () => ({
    __esModule: true,
    LegacyEventTileAdapter: ({ mxEvent }: any) => <div data-testid="legacy-event">{mxEvent.getId()}</div>,
}));

const mockGroupedEvent = new MatrixEvent({
    event_id: "$grouped",
    room_id: "!room:example.org",
    sender: "@alice:example.org",
    type: EventType.RoomCreate,
    content: { creator: "@alice:example.org" },
    origin_server_ts: 1712563200000,
});

const timelineVmInstances: any[] = [];

function createTimelinePanelViewModelMockInstance(items?: any[]): any {
    const instance = {
        isDisposed: false,
        start: jest.fn(),
        getSnapshot: () => ({
            items: items ?? [
                {
                    key: "new-room",
                    kind: "virtual",
                    type: "new-room",
                },
                {
                    key: "date-row",
                    kind: "virtual",
                    type: "date-separator",
                    vm: {
                        props: { roomId: "!room:example.org", ts: 1712563200000 },
                        getSnapshot: () => ({ label: "ignored" }),
                        subscribe: () => () => {},
                    },
                },
                {
                    key: "creation-group",
                    kind: "group",
                    type: "room-creation",
                    events: [mockGroupedEvent],
                    summaryMembers: undefined,
                    summaryText: "Alice created this room",
                },
            ],
        }),
        subscribe: () => () => {},
        dispose: jest.fn(),
    };
    instance.dispose.mockImplementation(() => {
        instance.isDisposed = true;
    });
    timelineVmInstances.push(instance);
    return instance;
}

function mockTimelinePanelViewModelConstructor(): any {
    return createTimelinePanelViewModelMockInstance();
}

jest.mock("../../../../../../../src/viewmodels/room/timeline/TimelinePanelViewModel", () => ({
    TimelinePanelViewModel: jest.fn(mockTimelinePanelViewModelConstructor),
}));

describe("TimelinePanelView", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        timelineVmInstances.length = 0;
    });

    it("renders the new room intro row", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        expect(screen.getByTestId("new-room-intro")).toHaveTextContent("room creation");
    });

    it("renders date separators from the timeline row view model instead of the raw item key", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        expect(screen.getByTestId("date-separator")).toHaveTextContent("separator:!room:example.org:1712563200000");
        expect(screen.queryByText("date-row")).not.toBeInTheDocument();
    });

    it("renders room creation groups", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        expect(screen.getByTestId("room-creation-group")).toHaveTextContent("Alice created this room");
    });

    it("renders legacy event rows from room events", () => {
        const liveEvent = new MatrixEvent({
            event_id: "$live",
            room_id: "!room:example.org",
            sender: "@alice:example.org",
            type: EventType.RoomMessage,
            content: { body: "Hello", msgtype: "m.text" },
            origin_server_ts: 1712563200000,
        });
        const room = {
            roomId: "!room:example.org",
            findEventById: jest.fn().mockReturnValue(liveEvent),
        } as any;
        const client = {} as any;

        mocked(TimelinePanelViewModel).mockImplementationOnce(
            () => createTimelinePanelViewModelMockInstance([{ key: "$live", kind: "event" }]) as any,
        );

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        expect(room.findEventById).toHaveBeenCalledWith("$live");
        expect(screen.getByTestId("legacy-event")).toHaveTextContent("$live");
    });

    it("passes the restored event id to the timeline view model when present", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} anchoredEventId="$restored" highlightedEventId="$highlighted" />
            </MatrixClientContext.Provider>,
        );

        expect(mocked(TimelinePanelViewModel)).toHaveBeenCalledWith({
            client,
            room,
            initialEventId: "$restored",
        });
    });

    it("uses the highlighted event id as the initial anchor when no restored event id is present", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} highlightedEventId="$highlighted" />
            </MatrixClientContext.Provider>,
        );

        expect(mocked(TimelinePanelViewModel)).toHaveBeenCalledWith({
            client,
            room,
            initialEventId: "$highlighted",
        });
    });

    it("replaces the timeline view model when the anchor event changes", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        const { rerender } = render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} anchoredEventId="$one" />
            </MatrixClientContext.Provider>,
        );

        const firstVm = timelineVmInstances.at(-1)!;

        rerender(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} anchoredEventId="$two" />
            </MatrixClientContext.Provider>,
        );

        const secondVm = timelineVmInstances.at(-1)!;
        expect(firstVm.isDisposed).toBe(true);
        expect(firstVm.dispose).toHaveBeenCalled();
        expect(secondVm.isDisposed).toBe(false);
        expect(mocked(TimelinePanelViewModel)).toHaveBeenLastCalledWith({
            client,
            room,
            initialEventId: "$two",
        });
    });

    it("disposes the previous timeline view model when the room changes", () => {
        const firstRoom = {
            roomId: "!room-one:example.org",
        } as any;
        const secondRoom = {
            roomId: "!room-two:example.org",
        } as any;
        const client = {} as any;

        const { rerender } = render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={firstRoom} />
            </MatrixClientContext.Provider>,
        );

        const firstVm = timelineVmInstances.at(-1)!;

        rerender(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={secondRoom} />
            </MatrixClientContext.Provider>,
        );

        const secondVm = timelineVmInstances.at(-1)!;
        expect(firstVm.isDisposed).toBe(true);
        expect(firstVm.dispose).toHaveBeenCalled();
        expect(secondVm.isDisposed).toBe(false);
    });

    it("disposes the timeline view model on unmount", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        const { unmount } = render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        const vm = timelineVmInstances.at(-1)!;
        unmount();

        expect(vm.isDisposed).toBe(true);
        expect(vm.dispose).toHaveBeenCalled();
    });
});
