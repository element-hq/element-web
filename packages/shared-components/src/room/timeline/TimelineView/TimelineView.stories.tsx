/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, type JSX } from "react";
import { useArgs } from "storybook/preview-api";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BaseViewModel } from "../../../core/viewmodel";
import { TimelineView } from "./TimelineView";
import type { TimelineItem, TimelineViewActions, TimelineViewSnapshot, VisibleRange } from "./types";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type MockTimelineItem = TimelineItem & {
    author: string;
    body: string;
    timestamp: string;
};

type TimelineViewStoryProps = {
    items: MockTimelineItem[];
    itemsSummary?: string;
    isAtLiveEdgeSummary?: boolean;
    onItemsChanged?: (items: MockTimelineItem[]) => void;
    onIsAtLiveEdgeChanged?: (isAtLiveEdge: boolean) => void;
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
const MODEL_WINDOW_LIMIT = 50;
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

function haveSameItemKeys(left: MockTimelineItem[], right: MockTimelineItem[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    for (let index = 0; index < left.length; index += 1) {
        if (left[index]?.key !== right[index]?.key) {
            return false;
        }
    }

    return true;
}

function formatItemsSummary(items: MockTimelineItem[]): string {
    const firstItem = items[0];
    const lastItem = items.at(-1);
    const firstIndex = firstItem ? getItemNumber(firstItem) : 0;
    const lastIndex = lastItem ? getItemNumber(lastItem) : 0;

    return `[${firstIndex}]...[${lastIndex}]`;
}

function applyWindowLimit(items: MockTimelineItem[], direction: "backward" | "forward"): MockTimelineItem[] {
    if (items.length <= MODEL_WINDOW_LIMIT) {
        return items;
    }

    return direction === "backward" ? items.slice(0, MODEL_WINDOW_LIMIT) : items.slice(-MODEL_WINDOW_LIMIT);
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
        const nextItems = items.slice(-MODEL_WINDOW_LIMIT);
        if (haveSameItemKeys(currentSnapshot.items, nextItems)) {
            return;
        }

        const nextSnapshot = createSnapshot(nextItems);

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
            const windowedItems = applyWindowLimit(nextItems, direction);
            const nextFirstItemNumber = windowedItems[0] ? getItemNumber(windowedItems[0]) : EARLIEST_ITEM_NUMBER;
            const nextLastItem = windowedItems.at(-1);
            const nextLastItemNumber = nextLastItem ? getItemNumber(nextLastItem) : LATEST_ITEM_NUMBER;

            this.snapshot.merge({
                items: windowedItems,
                backwardPagination: "idle",
                forwardPagination: "idle",
                canPaginateBackward: nextFirstItemNumber > EARLIEST_ITEM_NUMBER,
                canPaginateForward: nextLastItemNumber < LATEST_ITEM_NUMBER,
            });
            this.callbacks.onItemsChanged(windowedItems);
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

function TimelineViewStoryWrapperImpl({
    items,
    onItemsChanged,
    onIsAtLiveEdgeChanged,
}: Readonly<TimelineViewStoryProps>): JSX.Element {
    const vmRef = useRef<StoryTimelineViewModel | null>(null);
    const callbacksRef = useRef<StoryTimelineCallbacks>({
        onRequestMoreItems: () => undefined,
        onInitialFillCompleted: () => undefined,
        onVisibleRangeChanged: () => undefined,
        onScrollTargetReached: () => undefined,
        onIsAtLiveEdgeChanged: (isAtLiveEdge) => onIsAtLiveEdgeChanged?.(isAtLiveEdge),
        onItemsChanged: (nextItems) => onItemsChanged?.(nextItems),
    });

    callbacksRef.current.onItemsChanged = (nextItems) => onItemsChanged?.(nextItems);
    callbacksRef.current.onIsAtLiveEdgeChanged = (isAtLiveEdge) => onIsAtLiveEdgeChanged?.(isAtLiveEdge);

    if (!vmRef.current) {
        vmRef.current = new StoryTimelineViewModel(createSnapshot(items), callbacksRef.current);
    }

    useEffect(() => {
        vmRef.current?.syncItems(items);
    }, [items]);

    return (
        <div
            style={{
                height: "calc(100vh - 32px)",
                width: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <TimelineView
                vm={vmRef.current}
                renderItem={(item) => (
                    <article
                        style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid",
                        }}
                    >
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
                            <span style={{ fontSize: 12 }}>{item.timestamp}</span>
                        </div>
                        <div style={{ lineHeight: 1.4 }}>{item.body}</div>
                    </article>
                )}
            />
        </div>
    );
}

const TimelineViewStoryWrapper = withViewDocs(TimelineViewStoryWrapperImpl, TimelineView);

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
        itemsSummary: formatItemsSummary(createMockItems(INITIAL_ITEM_COUNT, INITIAL_START_INDEX)),
        isAtLiveEdgeSummary: true,
    },
    render: function Render(args): JSX.Element {
        const [, updateArgs] = useArgs<TimelineViewStoryProps>();
        return (
            <TimelineViewStoryWrapper
                {...args}
                onItemsChanged={(items) =>
                    updateArgs({
                        items,
                        itemsSummary: formatItemsSummary(items),
                    })
                }
                onIsAtLiveEdgeChanged={(isAtLiveEdge) =>
                    updateArgs({
                        isAtLiveEdgeSummary: isAtLiveEdge,
                    })
                }
            />
        );
    },
    argTypes: {
        items: {
            control: false,
            table: { disable: true },
        },
        itemsSummary: {
            control: { type: "text" },
            name: "items",
            table: {
                type: { summary: "string" },
            },
        },
        isAtLiveEdgeSummary: {
            control: { type: "boolean" },
            name: "isAtLiveEdge",
            table: {
                type: { summary: "boolean" },
            },
        },
        onItemsChanged: {
            control: false,
            table: { disable: true },
        },
        onIsAtLiveEdgeChanged: {
            control: false,
            table: { disable: true },
        },
    },
} satisfies Meta<typeof TimelineViewStoryWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
