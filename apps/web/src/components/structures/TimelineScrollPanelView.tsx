/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect } from "react";
import { FlatVirtualizedList } from "@element-hq/web-shared-components";
import classNames from "classnames";
import { flushSync } from "react-dom";

import type { ListItem } from "react-virtuoso";
import { type IScrollPanelProps } from "./ScrollPanel";
import type { TimelineRow } from "./MessagePanel";
import {
    type TimelineScrollPanelViewSnapshot,
    type TimelineVisibleRange,
} from "../../viewmodels/timeline/TimelineScrollPanelViewModel";
import type { VirtualizedListHandle } from "@element-hq/web-shared-components";

export interface TimelineScrollPanelItem {
    key: string;
    virtualKey?: string;
    domId?: string;
    node?: React.ReactNode;
    renderedNode?: React.ReactNode;
    row?: TimelineRow;
}

function sanitizeTimelineDomIdPart(value: string | null | undefined): string {
    if (!value) {
        return "unknown";
    }

    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function getTimelineItemDomId(item: TimelineScrollPanelItem | undefined): string | undefined {
    if (!item) {
        return undefined;
    }

    if (item.domId) {
        return item.domId;
    }

    if (item.row) {
        return ["mx_TimelinePanel", sanitizeTimelineDomIdPart(item.row.kind), sanitizeTimelineDomIdPart(item.key)].join(
            "_",
        );
    }

    return ["mx_TimelinePanel", "item", sanitizeTimelineDomIdPart(item.key)].join("_");
}

function withTimelineItemDomId(node: React.ReactNode, item: TimelineScrollPanelItem): React.ReactNode {
    const itemDomId = getTimelineItemDomId(item);
    if (!itemDomId || !React.isValidElement(node) || node.type !== "li") {
        return node;
    }

    const liNode = node as React.ReactElement<React.HTMLAttributes<HTMLLIElement>>;
    const childProps = liNode.props;
    return React.cloneElement(liNode, {
        ...childProps,
        id: itemDomId,
    });
}

function normalizeTimelineItemNode(node: React.ReactNode, item: TimelineScrollPanelItem): React.ReactNode {
    const nodeWithDomId = withTimelineItemDomId(node, item);

    if (!React.isValidElement(nodeWithDomId) || typeof nodeWithDomId.type === "string") {
        return nodeWithDomId;
    }

    return React.cloneElement(nodeWithDomId as React.ReactElement<{ as?: React.ElementType }>, {
        as: "div",
    });
}

type TimelineScrollPanelViewProps = IScrollPanelProps & {
    scrollContainerRef: (element: HTMLElement | Window | null) => void;
    onBeforeScrollNotify?: () => void;
    viewState: TimelineScrollPanelViewSnapshot;
    items: TimelineScrollPanelItem[];
    virtualListHandleRef?: React.Ref<VirtualizedListHandle>;
    scrollToBottomRequestId?: number;
    renderTimelineRow?: (row: TimelineRow) => React.ReactNode;
    onVisibleRangeChange?: (range: TimelineVisibleRange) => void;
};

interface TimelineScrollPanelListViewProps {
    items: TimelineScrollPanelItem[];
    renderItem: (item: TimelineScrollPanelItem) => React.ReactNode;
    scrollContainerRef: (element: HTMLElement | Window | null) => void;
    onBeforeScrollNotify?: () => void;
    onScroll?: IScrollPanelProps["onScroll"];
    onVisibleRangeChange?: (range: TimelineVisibleRange) => void;
    stickyBottom?: boolean;
    scrollToBottomRequestId?: number;
    virtualListHandleRef?: React.Ref<VirtualizedListHandle>;
}

function isScrollNodeAtBottom(scrollNode: HTMLDivElement | null): boolean {
    if (!scrollNode) {
        return false;
    }

    return scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight) <= 1;
}

function assignMergedRef<T>(target: React.Ref<T> | undefined, value: T): void {
    if (typeof target === "function") {
        target(value);
    } else if (target) {
        target.current = value;
    }
}

function readRefCurrent<T>(target: React.Ref<T> | undefined): T | null {
    if (!target || typeof target === "function") {
        return null;
    }

    return target.current;
}

type TimelineWrapperItemProps = React.HTMLAttributes<HTMLLIElement> & {
    "data-scroll-tokens"?: string;
};

function getWrapperItemProps(item: TimelineScrollPanelItem | undefined): TimelineWrapperItemProps {
    if (!item?.row || item.row.kind !== "event") {
        return item?.domId ? { id: item.domId } : {};
    }

    const { event, eventId } = item.row;
    const wrapperProps: TimelineWrapperItemProps = {};

    if (!event.status) {
        wrapperProps["data-scroll-tokens"] = eventId;
    }

    if (item.domId) {
        wrapperProps.id = item.domId;
    }

    return wrapperProps;
}

export function TimelineScrollPanelListView({
    items,
    renderItem,
    scrollContainerRef,
    onBeforeScrollNotify,
    onScroll,
    onVisibleRangeChange,
    stickyBottom,
    scrollToBottomRequestId,
    virtualListHandleRef,
}: TimelineScrollPanelListViewProps): React.ReactNode {
    const scrollElementRef = React.useRef<HTMLDivElement | null>(null);
    const onScrollRef = React.useRef(onScroll);
    const onBeforeScrollNotifyRef = React.useRef(onBeforeScrollNotify);
    const wasHiddenRef = React.useRef(false);
    const lastVisibleRangeRef = React.useRef<TimelineVisibleRange | null>(null);
    const lastRenderedItemsSignatureRef = React.useRef<string | null>(null);
    const hasUserScrolledRef = React.useRef(false);
    const isProgrammaticScrollRef = React.useRef(false);
    const hasInitializedPassiveBottomRef = React.useRef(false);
    const lastKnownScrollHeightRef = React.useRef(0);
    const lastPassiveAdjustmentAtRef = React.useRef(0);
    const lastScrollTopRef = React.useRef(0);
    const lastTouchYRef = React.useRef<number | null>(null);
    const lastReportedAtBottomRef = React.useRef(false);
    const programmaticScrollGenerationRef = React.useRef(0);
    const hasSeenRealUserInputRef = React.useRef(false);
    const [isPassiveBottomEnabled, setIsPassiveBottomEnabled] = React.useState(Boolean(stickyBottom));
    React.useEffect(() => {
        onScrollRef.current = onScroll;
    }, [onScroll]);
    React.useEffect(() => {
        onBeforeScrollNotifyRef.current = onBeforeScrollNotify;
    }, [onBeforeScrollNotify]);
    const disablePassiveBottom = React.useCallback((): void => {
        flushSync(() => {
            setIsPassiveBottomEnabled(false);
        });
    }, []);
    const markUserScrolled = React.useCallback((): void => {
        hasSeenRealUserInputRef.current = true;
        hasUserScrolledRef.current = true;
        programmaticScrollGenerationRef.current += 1;
        disablePassiveBottom();
    }, [disablePassiveBottom]);
    const handleWheelCapture = React.useCallback(
        (event: React.WheelEvent<HTMLDivElement>): void => {
            if (event.deltaY < 0) {
                markUserScrolled();
            }
        },
        [markUserScrolled],
    );
    const handleTouchStartCapture = React.useCallback((event: React.TouchEvent<HTMLDivElement>): void => {
        lastTouchYRef.current = event.touches[0]?.clientY ?? null;
    }, []);
    const handleTouchMoveCapture = React.useCallback(
        (event: React.TouchEvent<HTMLDivElement>): void => {
            const currentTouchY = event.touches[0]?.clientY ?? null;
            if (currentTouchY !== null && lastTouchYRef.current !== null && currentTouchY > lastTouchYRef.current) {
                markUserScrolled();
            }
            lastTouchYRef.current = currentTouchY;
        },
        [markUserScrolled],
    );
    const scrollLastItemIntoView = React.useCallback((): boolean => {
        if (items.length === 0) {
            return false;
        }

        const virtualListHandle = readRefCurrent(virtualListHandleRef);
        if (!virtualListHandle) {
            return false;
        }

        isProgrammaticScrollRef.current = true;
        lastPassiveAdjustmentAtRef.current = performance.now();
        virtualListHandle.scrollToIndex(items.length - 1, "end");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        });
        return true;
    }, [items, virtualListHandleRef]);
    const runProgrammaticScroll = React.useCallback((callback: (scrollNode: HTMLDivElement) => void): void => {
        const scrollNode = scrollElementRef.current;
        if (!scrollNode) {
            return;
        }

        isProgrammaticScrollRef.current = true;
        lastPassiveAdjustmentAtRef.current = performance.now();
        const generationAtSchedule = programmaticScrollGenerationRef.current;
        requestAnimationFrame(() => {
            if (generationAtSchedule !== programmaticScrollGenerationRef.current || hasUserScrolledRef.current) {
                isProgrammaticScrollRef.current = false;
                return;
            }
            callback(scrollNode);
            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        });
    }, []);
    const scrollToBottomWhilePassive = React.useCallback((): boolean => {
        const scrollNode = scrollElementRef.current;
        if (!scrollNode || scrollNode.scrollHeight === 0 || scrollNode.clientHeight === 0) {
            return false;
        }

        runProgrammaticScroll((scrollNode) => {
            scrollNode.scrollTop = scrollNode.scrollHeight;
            lastKnownScrollHeightRef.current = scrollNode.scrollHeight;
        });
        return true;
    }, [runProgrammaticScroll]);
    const handleScroll = React.useCallback(
        (event: Event): void => {
            const scrollNode = scrollElementRef.current;
            const previousScrollTop = lastScrollTopRef.current;
            const currentScrollTop = scrollNode?.scrollTop ?? previousScrollTop;
            const isAtBottom = isScrollNodeAtBottom(scrollNode);
            const movedUpward = currentScrollTop < previousScrollTop;
            const movedAwayFromBottom = scrollNode
                ? scrollNode.scrollHeight - (currentScrollTop + scrollNode.clientHeight) > 1
                : false;
            const detachedFromBottomByUser =
                stickyBottom &&
                hasSeenRealUserInputRef.current &&
                !hasUserScrolledRef.current &&
                (movedUpward || movedAwayFromBottom);
            const shouldRestorePassiveBottomAfterNonUserDrift =
                stickyBottom &&
                !hasSeenRealUserInputRef.current &&
                !hasUserScrolledRef.current &&
                !isProgrammaticScrollRef.current &&
                !isAtBottom;
            const shouldSuppressParentScrollNotification =
                stickyBottom &&
                !hasSeenRealUserInputRef.current &&
                !hasUserScrolledRef.current &&
                !detachedFromBottomByUser &&
                !isAtBottom;

            if (detachedFromBottomByUser) {
                hasUserScrolledRef.current = true;
                isProgrammaticScrollRef.current = false;
                programmaticScrollGenerationRef.current += 1;
                disablePassiveBottom();
            } else if (stickyBottom && isAtBottom && hasUserScrolledRef.current && !isProgrammaticScrollRef.current) {
                hasUserScrolledRef.current = false;
                setIsPassiveBottomEnabled(true);
            } else if (shouldRestorePassiveBottomAfterNonUserDrift) {
                setIsPassiveBottomEnabled(true);
                scrollToBottomWhilePassive();
            }

            if (!isProgrammaticScrollRef.current || detachedFromBottomByUser) {
                onBeforeScrollNotifyRef.current?.();
                if (!shouldSuppressParentScrollNotification) {
                    onScrollRef.current?.(event);
                }
            } else if (!lastReportedAtBottomRef.current && isAtBottom) {
                onBeforeScrollNotifyRef.current?.();
                onScrollRef.current?.(event);
            }

            lastReportedAtBottomRef.current = isAtBottom;
            lastScrollTopRef.current = currentScrollTop;
        },
        [disablePassiveBottom, scrollToBottomWhilePassive, stickyBottom],
    );
    const handleVisibleRangeChange = React.useCallback(
        (range: TimelineVisibleRange): void => {
            const previousRange = lastVisibleRangeRef.current;
            if (previousRange?.startIndex === range.startIndex && previousRange.endIndex === range.endIndex) {
                return;
            }

            lastVisibleRangeRef.current = range;
            if (stickyBottom && !hasUserScrolledRef.current && !hasInitializedPassiveBottomRef.current) {
                hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
            }

            onVisibleRangeChange?.(range);
        },
        [onVisibleRangeChange, scrollToBottomWhilePassive, stickyBottom],
    );
    const handleItemsRendered = React.useCallback(
        (renderedItems: ListItem<TimelineScrollPanelItem>[]): void => {
            const renderedItemsSignature = renderedItems
                .map(
                    (item) =>
                        `${item.originalIndex ?? item.index}:${item.data?.virtualKey ?? item.data?.key ?? "unknown"}`,
                )
                .join("|");
            if (lastRenderedItemsSignatureRef.current === renderedItemsSignature) {
                return;
            }
            lastRenderedItemsSignatureRef.current = renderedItemsSignature;
            if (lastVisibleRangeRef.current || renderedItems.length === 0) {
                return;
            }

            const firstRenderedItem = renderedItems[0];
            const lastRenderedItem = renderedItems[renderedItems.length - 1];
            const startIndex = firstRenderedItem.originalIndex ?? firstRenderedItem.index;
            const endIndex = lastRenderedItem.originalIndex ?? lastRenderedItem.index;

            handleVisibleRangeChange({ startIndex, endIndex });
        },
        [handleVisibleRangeChange],
    );
    const handleTotalListHeightChanged = React.useCallback((): void => {
        const scrollNode = scrollElementRef.current;
        if (!scrollNode) {
            return;
        }

        const currentScrollHeight = scrollNode.scrollHeight;
        const previousScrollHeight = lastKnownScrollHeightRef.current;
        if (currentScrollHeight === previousScrollHeight && hasInitializedPassiveBottomRef.current) {
            return;
        }
        lastKnownScrollHeightRef.current = currentScrollHeight;

        if (!stickyBottom || hasUserScrolledRef.current) {
            return;
        }

        if (!hasInitializedPassiveBottomRef.current) {
            hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
            return;
        }

        const delta = currentScrollHeight - previousScrollHeight;
        if (delta !== 0) {
            runProgrammaticScroll((node) => {
                node.scrollTop = Math.max(0, node.scrollTop + delta);
            });
        }
    }, [runProgrammaticScroll, scrollToBottomWhilePassive, stickyBottom]);
    useEffect(() => {
        if (!stickyBottom) {
            setIsPassiveBottomEnabled(false);
        }
    }, [stickyBottom]);
    useEffect(() => {
        if (!scrollToBottomRequestId) {
            return;
        }

        hasUserScrolledRef.current = false;
        setIsPassiveBottomEnabled(true);
        scrollLastItemIntoView();
        hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
    }, [scrollLastItemIntoView, scrollToBottomRequestId, scrollToBottomWhilePassive]);
    useEffect(() => {
        const isHidden = scrollElementRef.current?.offsetParent === null;
        if (isHidden) {
            wasHiddenRef.current = true;
            return;
        }

        if (!wasHiddenRef.current) {
            return;
        }

        wasHiddenRef.current = false;
        lastVisibleRangeRef.current = null;
        hasInitializedPassiveBottomRef.current = false;
        lastKnownScrollHeightRef.current = scrollElementRef.current?.scrollHeight ?? 0;

        requestAnimationFrame(() => {
            const virtualListHandle = readRefCurrent(virtualListHandleRef);
            if (!virtualListHandle || items.length === 0) {
                return;
            }

            if (stickyBottom && !hasUserScrolledRef.current) {
                virtualListHandle.scrollToIndex(items.length - 1, "end");
                hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
                return;
            }

            virtualListHandle.scrollToIndex(0, "start");
        });
    }, [items, scrollToBottomWhilePassive, stickyBottom, virtualListHandleRef]);

    const viewportIncrease = React.useMemo(() => ({ top: 400, bottom: 800 }), []);

    const Scroller = React.useMemo(
        () =>
            function TimelineScroller(
                props: React.ComponentProps<"div"> & {
                    context?: unknown;
                    ref?: React.Ref<HTMLDivElement>;
                },
            ): React.ReactNode {
                const { children, context: _context, ref, ...rest } = props;

                return (
                    <div
                        {...rest}
                        ref={(element) => {
                            if (typeof ref === "function") {
                                ref(element);
                            } else if (ref) {
                                ref.current = element;
                            }

                            scrollElementRef.current = element;
                            if (element) {
                                lastKnownScrollHeightRef.current = Math.max(
                                    lastKnownScrollHeightRef.current,
                                    element.scrollHeight,
                                );
                                lastScrollTopRef.current = element.scrollTop;
                                lastReportedAtBottomRef.current = isScrollNodeAtBottom(element);
                            }
                            scrollContainerRef(element);
                        }}
                        style={{
                            ...rest.style,
                            overflowAnchor: "none",
                        }}
                        onWheelCapture={handleWheelCapture}
                        onTouchStartCapture={handleTouchStartCapture}
                        onTouchMoveCapture={handleTouchMoveCapture}
                        onWheel={() => markUserScrolled()}
                        onMouseDown={() => markUserScrolled()}
                        onTouchMove={() => markUserScrolled()}
                        onPointerDown={() => markUserScrolled()}
                        onScroll={(event) => handleScroll(event.nativeEvent)}
                    >
                        {children}
                    </div>
                );
            },
        [
            handleScroll,
            handleTouchMoveCapture,
            handleTouchStartCapture,
            handleWheelCapture,
            markUserScrolled,
            scrollContainerRef,
        ],
    );
    const List = React.useMemo(
        () =>
            function TimelineList(
                props: React.ComponentProps<"div"> & {
                    context?: unknown;
                    ref?: React.Ref<HTMLDivElement>;
                },
            ): React.ReactNode {
                const { children, className, context: _context, ref, ...rest } = props;
                const listProps = rest as React.HTMLAttributes<HTMLOListElement>;

                return (
                    <ol
                        {...listProps}
                        ref={ref as React.Ref<HTMLOListElement>}
                        className={classNames("mx_RoomView_MessageList", className)}
                        style={{
                            ...listProps.style,
                            containIntrinsicSize: "auto",
                            contentVisibility: "visible",
                            display: "block",
                            justifyContent: "normal",
                            overflowAnchor: "none",
                            position: "static",
                        }}
                        aria-live="polite"
                    >
                        {children}
                    </ol>
                );
            },
        [],
    );
    const Item = React.useMemo(
        () =>
            function TimelineItem(
                props: React.ComponentProps<"div"> & {
                    context?: unknown;
                    ref?: React.Ref<HTMLDivElement>;
                    item?: unknown;
                },
            ): React.ReactNode {
                const { children, context: _context, item, ref, ...rest } = props;
                const mergedStyle: React.CSSProperties = {
                    ...rest.style,
                    minHeight: rest.style?.minHeight ?? 1,
                    overflowAnchor: "none",
                };

                if (React.isValidElement(children) && children.type === "li") {
                    const liChild = children as React.ReactElement<
                        React.HTMLAttributes<HTMLLIElement> & {
                            ref?: React.Ref<HTMLLIElement>;
                        }
                    >;
                    const itemProps = rest as unknown as React.HTMLAttributes<HTMLLIElement>;
                    const childProps = liChild.props as React.HTMLAttributes<HTMLLIElement> & {
                        ref?: React.Ref<HTMLLIElement>;
                    };

                    return (
                        <li
                            {...itemProps}
                            {...childProps}
                            ref={(element: HTMLLIElement | null) => {
                                if (element) {
                                    assignMergedRef(ref as React.Ref<HTMLLIElement> | undefined, element);
                                }
                                assignMergedRef(childProps.ref, element);
                            }}
                            className={classNames(itemProps.className, childProps.className)}
                            style={{
                                ...mergedStyle,
                                ...childProps.style,
                            }}
                        >
                            {childProps.children}
                        </li>
                    );
                }

                const wrapperItemProps = getWrapperItemProps(item as TimelineScrollPanelItem | undefined);
                return (
                    <li
                        {...(rest as unknown as React.HTMLAttributes<HTMLLIElement>)}
                        {...wrapperItemProps}
                        ref={ref as React.Ref<HTMLLIElement>}
                        style={mergedStyle}
                    >
                        {children}
                    </li>
                );
            },
        [],
    );
    const getVirtualizedItemComponent = React.useCallback(
        (_index: number, item: TimelineScrollPanelItem): React.JSX.Element => {
            const renderedItem = renderItem(item);
            return React.isValidElement(renderedItem) ? renderedItem : <>{renderedItem}</>;
        },
        [renderItem],
    );

    return (
        <FlatVirtualizedList
            listHandleRef={virtualListHandleRef}
            items={items}
            getItemKey={(item) => item.virtualKey ?? item.key}
            getItemComponent={getVirtualizedItemComponent}
            isItemFocusable={() => false}
            increaseViewportBy={viewportIncrease}
            alignToBottom={isPassiveBottomEnabled}
            followOutput={() => (isPassiveBottomEnabled ? "auto" : false)}
            itemsRendered={handleItemsRendered}
            rangeChanged={handleVisibleRangeChange}
            totalListHeightChanged={handleTotalListHeightChanged}
            style={{ flex: 1, minHeight: 0, height: "100%" }}
            components={{
                Item,
                List,
                Scroller,
            }}
        />
    );
}

export default function TimelineScrollPanelView(props: TimelineScrollPanelViewProps): React.ReactNode {
    const onScrollProp = (props as TimelineScrollPanelViewProps & { onScroll?: (this: void, event: Event) => void })
        .onScroll;
    const onScrollRef = React.useRef<((event: Event) => void) | undefined>(undefined);
    React.useEffect(() => {
        onScrollRef.current = onScrollProp
            ? (event: Event): void => {
                  onScrollProp(event);
              }
            : undefined;
    }, [onScrollProp]);
    const onBeforeScrollNotify = props.onBeforeScrollNotify;
    const onScroll = React.useCallback((event: Event): void => {
        (onScrollRef.current as ((this: void, event: Event) => void) | undefined)?.(event);
    }, []);
    const {
        scrollContainerRef,
        viewState,
        fixedChildren,
        className,
        style,
        items,
        virtualListHandleRef,
        scrollToBottomRequestId,
        renderTimelineRow,
        onVisibleRangeChange,
    } = props;
    void viewState;
    const renderItem = React.useCallback(
        (item: TimelineScrollPanelItem | undefined): React.ReactNode => {
            if (!item) {
                return null;
            }

            if (item.renderedNode !== undefined) {
                return item.renderedNode;
            }

            const renderedNode = item.row ? renderTimelineRow?.(item.row) : item.node;
            item.renderedNode = normalizeTimelineItemNode(renderedNode, item);
            return item.renderedNode;
        },
        [renderTimelineRow],
    );

    const rootStyle = {
        ...style,
        display: "flex",
        flexDirection: "column" as const,
        minHeight: 0,
    };

    return (
        <div
            className={classNames("mx_AutoHideScrollbar", "mx_ScrollPanel", className)}
            style={rootStyle}
            tabIndex={-1}
        >
            {fixedChildren}
            <div className="mx_RoomView_messageListWrapper" style={{ flex: 1, minHeight: 0 }}>
                <TimelineScrollPanelListView
                    items={items}
                    renderItem={renderItem}
                    scrollContainerRef={scrollContainerRef}
                    onBeforeScrollNotify={onBeforeScrollNotify}
                    onScroll={onScroll}
                    onVisibleRangeChange={onVisibleRangeChange}
                    stickyBottom={props.stickyBottom}
                    scrollToBottomRequestId={scrollToBottomRequestId}
                    virtualListHandleRef={virtualListHandleRef}
                />
            </div>
        </div>
    );
}
