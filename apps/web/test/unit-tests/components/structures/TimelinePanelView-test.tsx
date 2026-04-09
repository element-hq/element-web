/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { TimelinePanelView } from "../../../../src/components/structures/TimelinePanelView";
import { TimelinePanelViewModel } from "../../../../src/viewmodels/room/timeline/TimelinePanelViewModel";

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

jest.mock("../../../../src/components/views/rooms/NewRoomIntro", () => ({
    __esModule: true,
    default: () => <div data-testid="new-room-intro">room creation</div>,
}));

jest.mock("../../../../src/components/views/elements/GenericEventListSummary", () => ({
    __esModule: true,
    default: ({ summaryText, children }: any) => (
        <div data-testid="room-creation-group">
            <span>{summaryText}</span>
            {children}
        </div>
    ),
}));

const mockGroupedEvent = new MatrixEvent({
    event_id: "$grouped",
    room_id: "!room:example.org",
    sender: "@alice:example.org",
    type: EventType.RoomCreate,
    content: { creator: "@alice:example.org" },
    origin_server_ts: 1712563200000,
});

jest.mock("../../../../src/viewmodels/room/timeline/TimelinePanelViewModel", () => ({
    TimelinePanelViewModel: jest.fn().mockImplementation(() => ({
        getSnapshot: () => ({
            items: [
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
    })),
}));

describe("TimelinePanelView", () => {
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

    it("passes the restored event id to the timeline view model when present", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} initialAnchorEventId="$restored" highlightedEventId="$highlighted" />
            </MatrixClientContext.Provider>,
        );

        expect(mocked(TimelinePanelViewModel)).toHaveBeenCalledWith({
            client,
            room,
            initialEventId: "$restored",
        });
    });
});
