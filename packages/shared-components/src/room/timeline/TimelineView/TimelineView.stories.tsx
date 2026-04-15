/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, useState, type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StoryContext } from "storybook/internal/csf";
import { BaseViewModel } from "../../../core/viewmodel";
import { TimelineView } from "./TimelineView";
import type { NavigationAnchor, TimelineItem, TimelineViewActions, TimelineViewSnapshot, VisibleRange } from "./types";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type MockTimelineItem = TimelineItem & {
    author: string;
    body: string;
};

type TimelineViewStoryProps = {
    className?: string;
    items: MockTimelineItem[];
    itemsVersion?: number;
    initialIsAtLiveEdge?: boolean;
    triggerAppendAtLiveEdge?: boolean;
    initialScrollTarget?: NavigationAnchor | null;
    storyInstanceId?: string;
    onItemsChanged?: (items: MockTimelineItem[]) => void;
    onIsAtLiveEdgeChanged?: (isAtLiveEdge: boolean) => void;
};

type TimelineViewStoryRendererProps = TimelineViewStoryProps;

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
const AUTO_APPEND_STORY_LATEST_ITEM_NUMBER = 120;
const INITIAL_ITEM_COUNT = 10;
const INITIAL_START_INDEX = 91;

function createMockItems(count: number, startIndex = 1): MockTimelineItem[] {
    return Array.from({ length: count }, (_, index) => {
        const itemNumber = startIndex + index;
        const fragment = MESSAGE_FRAGMENTS[(itemNumber - 1) % MESSAGE_FRAGMENTS.length];
        const extraLines = " Additional detail.".repeat((itemNumber - 1) % 4);

        return {
            key: `event-${itemNumber}`,
            kind: "event",
            author: AUTHORS[(itemNumber - 1) % AUTHORS.length],
            body: `${fragment}${extraLines}`,
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

function applyWindowLimit(items: MockTimelineItem[], direction: "backward" | "forward"): MockTimelineItem[] {
    if (items.length <= MODEL_WINDOW_LIMIT) {
        return items;
    }

    return direction === "backward" ? items.slice(0, MODEL_WINDOW_LIMIT) : items.slice(-MODEL_WINDOW_LIMIT);
}

function createSnapshot(
    items: MockTimelineItem[],
    options?: {
        isAtLiveEdge?: boolean;
        scrollTarget?: NavigationAnchor | null;
    },
): TimelineViewSnapshot<MockTimelineItem> {
    const firstItemNumber = items[0] ? getItemNumber(items[0]) : EARLIEST_ITEM_NUMBER;
    const lastItem = items.at(-1);
    const lastItemNumber = lastItem ? getItemNumber(lastItem) : LATEST_ITEM_NUMBER;
    const isAtLiveEdge = options?.isAtLiveEdge ?? true;
    const hasExplicitScrollTarget = options !== undefined && Object.hasOwn(options, "scrollTarget");
    const defaultScrollTarget: NavigationAnchor | null = lastItem
        ? { targetKey: lastItem.key, position: "bottom" }
        : null;
    const scrollTarget = hasExplicitScrollTarget ? (options?.scrollTarget ?? null) : defaultScrollTarget;

    return {
        items,
        isAtLiveEdge,
        canPaginateBackward: firstItemNumber > EARLIEST_ITEM_NUMBER,
        canPaginateForward: lastItemNumber < LATEST_ITEM_NUMBER,
        backwardPagination: "idle",
        forwardPagination: "idle",
        scrollTarget,
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
    private itemsVersion = 0;

    public constructor(snapshot: TimelineViewSnapshot<MockTimelineItem>, callbacks: StoryTimelineCallbacks) {
        super(undefined, snapshot);
        this.callbacks = callbacks;
    }

    public syncItems(items: MockTimelineItem[], version = 0): void {
        if (version < this.itemsVersion) {
            return;
        }

        const currentSnapshot = this.getSnapshot();
        const nextItems = items.slice(-MODEL_WINDOW_LIMIT);
        if (haveSameItemKeys(currentSnapshot.items, nextItems)) {
            this.itemsVersion = version;
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
        this.itemsVersion = version;
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
        }, 100);
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

const TimelineViewStoryWrapperImpl = ({
    className,
    items,
    itemsVersion = 0,
    initialIsAtLiveEdge,
    initialScrollTarget,
    storyInstanceId,
    onItemsChanged,
    onIsAtLiveEdgeChanged,
}: Readonly<TimelineViewStoryProps>): JSX.Element => {
    const vmRef = useRef<StoryTimelineViewModel | null>(null);
    const storyInstanceIdRef = useRef<string | undefined>(storyInstanceId);
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

    if (storyInstanceIdRef.current !== storyInstanceId) {
        vmRef.current?.dispose();
        vmRef.current = null;
        storyInstanceIdRef.current = storyInstanceId;
    }

    if (!vmRef.current) {
        vmRef.current = new StoryTimelineViewModel(
            createSnapshot(items, {
                isAtLiveEdge: initialIsAtLiveEdge ?? !initialScrollTarget,
                scrollTarget: initialScrollTarget,
            }),
            callbacksRef.current,
        );
    }

    useEffect(() => {
        vmRef.current?.syncItems(items, itemsVersion);
    }, [items, itemsVersion]);

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
                className={className}
                renderItem={(item) => (
                    <article
                        style={{
                            padding: "12px 16px",
                            marginRight: "12px",
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
                            <span style={{ fontSize: 12 }}>{item.key}</span>
                        </div>
                        <div style={{ lineHeight: 1.4 }}>{item.body}</div>
                    </article>
                )}
            />
        </div>
    );
};

const TimelineViewStoryWrapper = withViewDocs(TimelineViewStoryWrapperImpl, TimelineView);

const TimelineViewStoryRenderer = ({ ...args }: TimelineViewStoryRendererProps): JSX.Element => {
    const [renderedItems, setRenderedItems] = useState(args.items);
    const [renderedItemsVersion, setRenderedItemsVersion] = useState(args.itemsVersion ?? 0);
    const [renderedIsAtLiveEdge, setRenderedIsAtLiveEdge] = useState(
        args.initialIsAtLiveEdge ?? !args.initialScrollTarget,
    );
    const itemsVersionRef = React.useRef(args.itemsVersion ?? 0);
    const autoAppendAwaitingLiveEdgeCycleRef = React.useRef(false);
    const autoAppendSawNotLiveEdgeRef = React.useRef(false);

    useEffect(() => {
        const nextItemsVersion = args.itemsVersion ?? 0;
        itemsVersionRef.current = nextItemsVersion;
        setRenderedItems(args.items);
        setRenderedItemsVersion(nextItemsVersion);
        setRenderedIsAtLiveEdge(args.initialIsAtLiveEdge ?? !args.initialScrollTarget);
        autoAppendAwaitingLiveEdgeCycleRef.current = false;
        autoAppendSawNotLiveEdgeRef.current = false;
    }, [args.items, args.itemsVersion, args.initialIsAtLiveEdge, args.initialScrollTarget]);

    useEffect(() => {
        if (!autoAppendAwaitingLiveEdgeCycleRef.current) {
            return;
        }

        if (!renderedIsAtLiveEdge) {
            autoAppendSawNotLiveEdgeRef.current = true;
            return;
        }

        if (autoAppendSawNotLiveEdgeRef.current) {
            autoAppendAwaitingLiveEdgeCycleRef.current = false;
            autoAppendSawNotLiveEdgeRef.current = false;
        }
    }, [renderedIsAtLiveEdge]);

    useEffect(() => {
        if (!args.triggerAppendAtLiveEdge || !renderedIsAtLiveEdge) {
            return;
        }

        const timerId = window.setInterval(() => {
            if (autoAppendAwaitingLiveEdgeCycleRef.current) {
                return;
            }

            const lastItem = renderedItems.at(-1);
            const nextItemNumber = lastItem ? getItemNumber(lastItem) + 1 : EARLIEST_ITEM_NUMBER;

            if (nextItemNumber > AUTO_APPEND_STORY_LATEST_ITEM_NUMBER) {
                return;
            }

            const nextItems = applyWindowLimit([...renderedItems, ...createMockItems(1, nextItemNumber)], "forward");
            const nextItemsVersion = itemsVersionRef.current + 1;
            itemsVersionRef.current = nextItemsVersion;
            setRenderedItems(nextItems);
            setRenderedItemsVersion(nextItemsVersion);
            autoAppendAwaitingLiveEdgeCycleRef.current = true;
            autoAppendSawNotLiveEdgeRef.current = false;
        }, 500);

        return () => {
            window.clearInterval(timerId);
        };
    }, [args.triggerAppendAtLiveEdge, renderedIsAtLiveEdge, renderedItems]);

    return (
        <TimelineViewStoryWrapper
            {...args}
            items={renderedItems}
            itemsVersion={renderedItemsVersion}
            onItemsChanged={(items) => {
                const nextItemsVersion = itemsVersionRef.current + 1;
                itemsVersionRef.current = nextItemsVersion;
                setRenderedItems(items);
                setRenderedItemsVersion(nextItemsVersion);
            }}
            onIsAtLiveEdgeChanged={(isAtLiveEdge) => {
                setRenderedIsAtLiveEdge(isAtLiveEdge);
            }}
        />
    );
};

const meta = {
    title: "Room/Timeline/TimelineView",
    component: TimelineViewStoryWrapper,
    tags: ["autodocs"],
    parameters: {
        controls: {
            exclude: [
                "storyInstanceId",
                "initialIsAtLiveEdge",
                "triggerAppendAtLiveEdge",
                "initialScrollTarget",
                "items",
                "itemsVersion",
                "onItemsChanged",
                "onIsAtLiveEdgeChanged",
            ],
        },
    },
    args: {
        className: undefined,
    },
    render: function Render(args, context: StoryContext): JSX.Element {
        return <TimelineViewStoryRenderer {...args} storyInstanceId={context.id} />;
    },
    argTypes: {
        className: {
            control: { type: "text" },
            table: {
                type: { summary: "string" },
            },
        },
    },
} satisfies Meta<typeof TimelineViewStoryWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;
const disableDocsStoryRendering = {
    docs: {
        disable: true,
    },
} as const;

async function waitForStoryToSettle(): Promise<void> {
    await new Promise((resolve) => {
        window.setTimeout(resolve, 5000);
    });
}

const startAtLiveEdgeItems = createMockItems(40, 61);

export const StartAtLiveEdge: Story = {
    parameters: disableDocsStoryRendering,
    args: {
        items: startAtLiveEdgeItems,
        initialIsAtLiveEdge: true,
    },
    async play(): Promise<void> {
        await waitForStoryToSettle();
    },
};

const startAtTargetItems = createMockItems(INITIAL_ITEM_COUNT, 41);
const startAtTargetScrollTarget: NavigationAnchor = {
    targetKey: "event-45",
    position: "bottom",
};

export const StartAtTarget: Story = {
    parameters: disableDocsStoryRendering,
    args: {
        items: startAtTargetItems,
        initialScrollTarget: startAtTargetScrollTarget,
    },
    async play(): Promise<void> {
        await waitForStoryToSettle();
    },
};

const liveEdgeTriggerAppendItems = createMockItems(INITIAL_ITEM_COUNT, INITIAL_START_INDEX);

export const LiveEdgeTriggerAppend: Story = {
    parameters: disableDocsStoryRendering,
    args: {
        items: liveEdgeTriggerAppendItems,
        itemsVersion: 0,
        triggerAppendAtLiveEdge: true,
        initialScrollTarget: null,
    },
    async play(): Promise<void> {
        await waitForStoryToSettle();
    },
};
