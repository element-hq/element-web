/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { type MatrixClient, type MatrixEvent, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import type { TimelineItem } from "@element-hq/web-shared-components";

import { NewTimelinePanel } from "./NewTimelinePanel";
import { Layout } from "../../settings/enums/Layout";
import EditorStateTransfer from "../../utils/EditorStateTransfer";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { createTestClient, mkMessage } from "../../../test/test-utils";

const ROOM_ID = "!room:example.org";
const USER_ID = "@alice:example.org";

// The virtualised TimelineView needs real layout, which this environment has none
// of, and it has its own tests in shared-components. Stand in a stub that simply
// draws every row, so these tests cover how this panel renders each kind of row.
const { rowsRendered } = vi.hoisted(() => ({ rowsRendered: { current: [] as unknown[] } }));

vi.mock("@element-hq/web-shared-components", async () => {
    const actual = await vi.importActual<typeof import("@element-hq/web-shared-components")>(
        "@element-hq/web-shared-components",
    );
    return {
        ...actual,
        TimelineView: ({
            vm,
            renderItem,
        }: {
            vm: { getSnapshot: () => { items: TimelineItem[] } };
            renderItem: (item: TimelineItem) => React.ReactNode;
        }) => {
            const items = vm.getSnapshot().items;
            rowsRendered.current = items;
            return <div data-testid="timeline-stub">{items.map((item) => renderItem(item))}</div>;
        },
    };
});

// The view model has its own tests; here it only needs to hand the view a set of
// rows, so stand in a fake whose rows each test controls.
const { vmState } = vi.hoisted(() => ({
    // One snapshot object, replaced only by setRows: useSyncExternalStore compares
    // snapshots by identity, so handing back a fresh object each call would loop.
    vmState: {
        snapshot: {} as Record<string, unknown>,
        setRows(items: unknown[]) {
            this.snapshot = {
                items,
                atLiveEnd: true,
                pendingAnchor: null,
                highlightedEventId: null,
                isAtBottom: true,
                canJumpToReadMarker: false,
                numUnreadMessages: 0,
                hasHighlights: false,
            };
        },
    },
}));

vi.mock("../../viewmodels/room/timeline/RoomTimelineViewModel", () => ({
    RoomTimelineViewModel: class {
        public start = (): void => {};
        public dispose = (): void => {};
        public subscribe = (): (() => void) => (): void => {};
        public getSnapshot = (): Record<string, unknown> => vmState.snapshot;
    },
}));

// EventTile pulls in a large tree that isn't what these tests are about; record
// what the row asked for instead.
const { tileProps } = vi.hoisted(() => ({ tileProps: { current: [] as Record<string, unknown>[] } }));

vi.mock("../views/rooms/LegacyEventTileAdapter", () => ({
    LegacyEventTileAdapter: (props: Record<string, unknown>) => {
        tileProps.current.push(props);
        return <div data-testid="event-row" />;
    },
}));

describe("<NewTimelinePanel />", () => {
    let client: MatrixClient;
    let room: Room;
    let event: MatrixEvent;

    const renderPanel = (props: Partial<React.ComponentProps<typeof NewTimelinePanel>> = {}) =>
        render(
            <MatrixClientContext.Provider value={client}>
                <NewTimelinePanel room={room} {...props} />
            </MatrixClientContext.Provider>,
        );

    /** Set the rows the timeline is given to draw. */
    const withItems = (items: TimelineItem[]): void => {
        vmState.setRows(items);
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        tileProps.current = [];
        rowsRendered.current = [];
        vmState.setRows([]);
        client = createTestClient();
        room = new Room(ROOM_ID, client, USER_ID, { pendingEventOrdering: PendingEventOrdering.Detached });
        vi.spyOn(client, "getRoom").mockReturnValue(room);
        event = mkMessage({ room: ROOM_ID, user: USER_ID, msg: "hello", event: true });
        room.getUnfilteredTimelineSet().addLiveEvent(event, { addToState: false });
    });

    it("draws a row for a message in the room", () => {
        withItems([{ key: event.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem]);

        renderPanel();

        expect(screen.getByTestId("event-row")).toBeInTheDocument();
        expect(tileProps.current[0].mxEvent).toBe(event);
    });

    it("skips a row whose event is no longer in the room instead of failing", () => {
        withItems([{ key: "$gone", kind: "event", continuation: false, lastInSection: true } as TimelineItem]);

        renderPanel();

        // The row is simply absent; rendering the rest of the timeline still succeeded.
        expect(screen.queryByTestId("event-row")).toBeNull();
        expect(screen.getByTestId("timeline-stub")).toBeInTheDocument();
    });

    it('labels the read marker "New"', () => {
        withItems([{ key: "$marker", kind: "read-marker" } as TimelineItem]);

        renderPanel();

        expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("announces the loading row to screen readers", () => {
        withItems([{ key: "loading", kind: "loading" } as TimelineItem]);

        renderPanel();

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("shows a date separator's label", () => {
        withItems([{ key: "$sep", kind: "date-separator", label: "Today" } as TimelineItem]);

        renderPanel();

        expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("draws nothing for a gap, matching the old timeline", () => {
        withItems([{ key: "$gap", kind: "gap" } as TimelineItem]);

        renderPanel();

        expect(screen.getByTestId("timeline-stub")).toBeEmptyDOMElement();
    });

    it("falls back to the modern layout when IRC is selected", () => {
        withItems([{ key: event.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem]);

        renderPanel({ layout: Layout.IRC });

        expect(tileProps.current[0].layout).toBe(Layout.Group);
    });

    it("passes the message layout through unchanged", () => {
        withItems([{ key: event.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem]);

        renderPanel({ layout: Layout.Bubble });

        expect(tileProps.current[0].layout).toBe(Layout.Bubble);
    });

    it("gives the edit state only to the message being edited", () => {
        const other = mkMessage({ room: ROOM_ID, user: USER_ID, msg: "other", event: true });
        room.getUnfilteredTimelineSet().addLiveEvent(other, { addToState: false });
        const editState = new EditorStateTransfer(event);
        withItems([
            { key: event.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem,
            { key: other.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem,
        ]);

        renderPanel({ editState });

        expect(tileProps.current[0].editState).toBe(editState);
        expect(tileProps.current[1].editState).toBeUndefined();
    });

    it("hides the panel without unmounting it", () => {
        withItems([]);

        const { container } = renderPanel({ hidden: true });

        expect(container.querySelector(".mx_NewTimelinePanel")).toHaveStyle({ display: "none" });
        expect(screen.getByTestId("timeline-stub")).toBeInTheDocument();
    });

    it("lets tiles look up relations, so reactions can render", () => {
        withItems([{ key: event.getId()!, kind: "event", continuation: false, lastInSection: true } as TimelineItem]);

        renderPanel();

        const getRelationsForEvent = tileProps.current[0].getRelationsForEvent as (
            id: string,
            rel: string,
            type: string,
        ) => unknown;
        expect(typeof getRelationsForEvent).toBe("function");
        // Nothing has reacted, so there are no relations to find — but the lookup
        // has to reach the room without throwing.
        expect(getRelationsForEvent(event.getId()!, "m.annotation", "m.reaction")).toBeUndefined();
    });
});
