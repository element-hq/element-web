/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, type CSSProperties, type JSX } from "react";
import { useArgs } from "storybook/preview-api";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BaseViewModel } from "../../../core/viewmodel";
import { TimelineView } from "./TimelineView";
import type { TimelineItem, TimelineViewActions, TimelineViewSnapshot, VisibleRange } from "./types";

type MockTimelineItem = TimelineItem & {
    author: string;
    body: string;
    timestamp: string;
};

type TimelineViewStoryProps = {
    items: MockTimelineItem[];
    onItemsChanged?: (items: MockTimelineItem[]) => void;
};

const AUTHORS = ["Alice", "Bob", "Charlie", "Dani", "Elliot", "Frank", "Greta", "Hana", "Isaac", "Jules"];
const MESSAGE_FRAGMENTS = [
    "Short status update.",
    "This message is a bit longer so the timeline shows some natural variation between rows.",
    "A longer message helps exercise wrapping behavior in the story and makes the viewport feel closer to a real conversation thread.",
    "This item adds even more text. It is intentionally long enough to span multiple lines and make virtualization easier to evaluate visually when scrolling through the mocked timeline.",
    "Tiny reply.",
    "Another medium-sized message that sits between the short and long examples.",
    "This story data is generated rather than hard coded so it is easier to extend later with different states, anchors, and pagination scenarios.",
    "A compact follow-up.",
    "This is one of the larger mock messages in the list. It gives the default story more visual rhythm and helps show that the shared container handles rows with very different heights.",
    "Closing note with enough text to avoid every item looking identical in the default Storybook example.",
];
const PAGE_SIZE = 10;
const EARLIEST_ITEM_NUMBER = 1;
const LATEST_ITEM_NUMBER = 100;
const INITIAL_ITEM_COUNT = 10;
const INITIAL_START_INDEX = 91;

function createMockItems(count: number, startIndex = 1): MockTimelineItem[] {
    return Array.from({ length: count }, (_, index) => {
        const itemNumber = startIndex + index;
        const fragment = MESSAGE_FRAGMENTS[(itemNumber - 1) % MESSAGE_FRAGMENTS.length];
        const extraLines = " Additional detail.".repeat((itemNumber - 1) % 4);
        const totalMinutes = 9 * 60 + 10 + itemNumber;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;

        return {
            key: `event-${itemNumber}`,
            kind: "event",
            author: AUTHORS[(itemNumber - 1) % AUTHORS.length],
            body: `${fragment}${extraLines}`,
            timestamp: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        };
    });
}

function getItemNumber(item: MockTimelineItem): number {
    return Number(item.key.replace("event-", ""));
}

function createSnapshot(items: MockTimelineItem[]): TimelineViewSnapshot<MockTimelineItem> {
    const firstItemNumber = items[0] ? getItemNumber(items[0]) : EARLIEST_ITEM_NUMBER;
    const lastItem = items.at(-1);
    const lastItemNumber = lastItem ? getItemNumber(lastItem) : LATEST_ITEM_NUMBER;

    return {
        items,
        isAtLiveEdge: true,
        canPaginateBackward: firstItemNumber > EARLIEST_ITEM_NUMBER,
        canPaginateForward: lastItemNumber < LATEST_ITEM_NUMBER,
        backwardPagination: "idle",
        forwardPagination: "idle",
        scrollTarget: lastItem ? { targetKey: lastItem.key, position: "bottom" } : null,
    };
}

type StoryTimelineCallbacks = TimelineViewActions & {
    onItemsChanged: (items: MockTimelineItem[]) => void;
};

class StoryTimelineViewModel
    extends BaseViewModel<TimelineViewSnapshot<MockTimelineItem>, undefined>
    implements TimelineViewActions
{
    private readonly callbacks: StoryTimelineCallbacks;
    private pendingPaginationTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(snapshot: TimelineViewSnapshot<MockTimelineItem>, callbacks: StoryTimelineCallbacks) {
        super(undefined, snapshot);
        this.callbacks = callbacks;
    }

    public syncItems(items: MockTimelineItem[]): void {
        const currentSnapshot = this.getSnapshot();
        const nextSnapshot = createSnapshot(items);

        this.snapshot.merge({
            ...nextSnapshot,
            backwardPagination: currentSnapshot.backwardPagination,
            forwardPagination: currentSnapshot.forwardPagination,
            scrollTarget: currentSnapshot.scrollTarget,
            isAtLiveEdge: currentSnapshot.isAtLiveEdge,
        });
    }

    public onRequestMoreItems(direction: "backward" | "forward"): void {
        this.callbacks.onRequestMoreItems(direction);

        const currentSnapshot = this.getSnapshot();
        if (direction === "backward" && !currentSnapshot.canPaginateBackward) {
            return;
        }
        if (direction === "forward" && !currentSnapshot.canPaginateForward) {
            return;
        }

        const paginationState =
            direction === "backward" ? currentSnapshot.backwardPagination : currentSnapshot.forwardPagination;
        if (paginationState === "loading") {
            return;
        }

        this.snapshot.merge({
            backwardPagination: direction === "backward" ? "loading" : currentSnapshot.backwardPagination,
            forwardPagination: direction === "forward" ? "loading" : currentSnapshot.forwardPagination,
        });

        if (this.pendingPaginationTimer !== null) {
            clearTimeout(this.pendingPaginationTimer);
        }

        this.pendingPaginationTimer = setTimeout(() => {
            const latestSnapshot = this.getSnapshot();
            const latestItems = latestSnapshot.items;
            const latestFirstItemNumber = latestItems[0] ? getItemNumber(latestItems[0]) : EARLIEST_ITEM_NUMBER;
            const latestLastItem = latestItems.at(-1);
            const latestLastItemNumber = latestLastItem ? getItemNumber(latestLastItem) : 0;
            const latestPrependStart = Math.max(EARLIEST_ITEM_NUMBER, latestFirstItemNumber - PAGE_SIZE);
            const latestPrependCount = Math.max(0, latestFirstItemNumber - latestPrependStart);
            const appendStart = latestLastItemNumber + 1;
            const appendCount = Math.max(0, Math.min(PAGE_SIZE, LATEST_ITEM_NUMBER - latestLastItemNumber));

            const nextItems =
                direction === "backward"
                    ? [...createMockItems(latestPrependCount, latestPrependStart), ...latestItems]
                    : [...latestItems, ...createMockItems(appendCount, appendStart)];
            const nextFirstItemNumber = nextItems[0] ? getItemNumber(nextItems[0]) : EARLIEST_ITEM_NUMBER;
            const nextLastItem = nextItems.at(-1);
            const nextLastItemNumber = nextLastItem ? getItemNumber(nextLastItem) : LATEST_ITEM_NUMBER;

            this.snapshot.merge({
                items: nextItems,
                backwardPagination: "idle",
                forwardPagination: "idle",
                canPaginateBackward: nextFirstItemNumber > EARLIEST_ITEM_NUMBER,
                canPaginateForward: nextLastItemNumber < LATEST_ITEM_NUMBER,
            });
            this.callbacks.onItemsChanged(nextItems);
            this.pendingPaginationTimer = null;
        }, 1000);
    }

    public onInitialFillCompleted(): void {
        this.callbacks.onInitialFillCompleted();
    }

    public onVisibleRangeChanged(range: VisibleRange): void {
        this.callbacks.onVisibleRangeChanged(range);
    }

    public onScrollTargetReached(): void {
        this.callbacks.onScrollTargetReached();
        this.snapshot.merge({ scrollTarget: null });
    }

    public onIsAtLiveEdgeChanged(isAtLiveEdge: boolean): void {
        this.callbacks.onIsAtLiveEdgeChanged(isAtLiveEdge);
        this.snapshot.merge({ isAtLiveEdge });
    }

    public override dispose(): void {
        if (this.pendingPaginationTimer !== null) {
            clearTimeout(this.pendingPaginationTimer);
            this.pendingPaginationTimer = null;
        }
        super.dispose();
    }
}

const rowStyle: CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid #e6e8eb",
    background: "#ffffff",
};

function TimelineViewStoryWrapper({ items, onItemsChanged }: Readonly<TimelineViewStoryProps>): JSX.Element {
    const vmRef = useRef<StoryTimelineViewModel | null>(null);
    const callbacksRef = useRef<StoryTimelineCallbacks>({
        onRequestMoreItems: () => undefined,
        onInitialFillCompleted: () => undefined,
        onVisibleRangeChanged: () => undefined,
        onScrollTargetReached: () => undefined,
        onIsAtLiveEdgeChanged: () => undefined,
        onItemsChanged: (nextItems) => onItemsChanged?.(nextItems),
    });

    callbacksRef.current.onItemsChanged = (nextItems) => onItemsChanged?.(nextItems);

    if (!vmRef.current) {
        vmRef.current = new StoryTimelineViewModel(createSnapshot(items), callbacksRef.current);
    }

    useEffect(() => {
        vmRef.current?.syncItems(items);
    }, [items]);

    return (
        <div style={{ height: "400px", width: "600px", border: "1px solid #d8dee4", overflow: "hidden" }}>
            <TimelineView
                vm={vmRef.current}
                renderItem={(item) => (
                    <article style={rowStyle}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 6,
                            }}
                        >
                            <strong>{item.author}</strong>
                            <span style={{ fontSize: 12, color: "#57606a" }}>{item.timestamp}</span>
                        </div>
                        <div style={{ color: "#1f2328", lineHeight: 1.4 }}>{item.body}</div>
                    </article>
                )}
            />
        </div>
    );
}

const meta = {
    title: "Room/Timeline/TimelineView",
    component: TimelineViewStoryWrapper,
    tags: ["autodocs"],
    parameters: {
        controls: {
            expanded: false,
        },
    },
    args: {
        items: createMockItems(INITIAL_ITEM_COUNT, INITIAL_START_INDEX),
    },
    render: function Render(args): JSX.Element {
        const [, updateArgs] = useArgs<TimelineViewStoryProps>();
        return <TimelineViewStoryWrapper {...args} onItemsChanged={(items) => updateArgs({ items })} />;
    },
    argTypes: {
        items: {
            control: { type: "object" },
            table: {
                type: { summary: "MockTimelineItem[]" },
            },
        },
        onItemsChanged: {
            control: false,
            table: { disable: true },
        },
    },
} satisfies Meta<typeof TimelineViewStoryWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
