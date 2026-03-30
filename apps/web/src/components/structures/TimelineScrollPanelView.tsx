/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect } from "react";
import { FlatVirtualizedList } from "@element-hq/web-shared-components";
import classNames from "classnames";

import { type IScrollPanelProps } from "./ScrollPanel";
import type { TimelineRow } from "./MessagePanel";
import Spinner from "../views/elements/Spinner";
import { type TimelineScrollPanelViewSnapshot, type TimelineVisibleRange } from "../../viewmodels/timeline/TimelineScrollPanelViewModel";
import type { VirtualizedListHandle } from "@element-hq/web-shared-components";

export interface TimelineScrollPanelItem {
    key: string;
    virtualKey?: string;
    domId?: string;
    node?: React.ReactNode;
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

type TimelineScrollPanelViewProps = IScrollPanelProps & {
    scrollContainerRef: (element: HTMLElement | Window | null) => void;
    viewState: TimelineScrollPanelViewSnapshot;
    items: TimelineScrollPanelItem[];
    hasTopSpinner?: boolean;
    hasBottomSpinner?: boolean;
    virtualListHandleRef?: React.Ref<VirtualizedListHandle>;
    scrollToBottomRequestId?: number;
    renderTimelineRow?: (row: TimelineRow) => React.ReactNode;
    onVisibleRangeChange?: (range: TimelineVisibleRange) => void;
};

interface TimelineScrollPanelListViewProps {
    items: TimelineScrollPanelItem[];
    renderItem: (item: TimelineScrollPanelItem) => React.ReactNode;
    scrollContainerRef: (element: HTMLElement | Window | null) => void;
    onScroll?: IScrollPanelProps["onScroll"];
    onVisibleRangeChange?: (range: TimelineVisibleRange) => void;
    stickyBottom?: boolean;
    scrollToBottomRequestId?: number;
    virtualListHandleRef?: React.Ref<VirtualizedListHandle>;
}

function assignMergedRef<T>(target: React.Ref<T> | undefined, value: T): void {
    if (typeof target === "function") {
        target(value);
    } else if (target) {
        target.current = value;
    }
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
    onScroll,
    onVisibleRangeChange,
    stickyBottom,
    scrollToBottomRequestId,
    virtualListHandleRef,
}: TimelineScrollPanelListViewProps): React.ReactNode {
    const scrollElementRef = React.useRef<HTMLDivElement | null>(null);
    const hasUserScrolledRef = React.useRef(false);
    const isProgrammaticScrollRef = React.useRef(false);
    const hasInitializedPassiveBottomRef = React.useRef(false);
    const lastKnownScrollHeightRef = React.useRef(0);
    const lastPassiveAdjustmentAtRef = React.useRef(0);
    const markUserScrolled = React.useCallback((): void => {
        hasUserScrolledRef.current = true;
    }, []);
    const runProgrammaticScroll = React.useCallback((callback: (scrollNode: HTMLDivElement) => void): void => {
        const scrollNode = scrollElementRef.current;
        if (!scrollNode) {
            return;
        }

        isProgrammaticScrollRef.current = true;
        lastPassiveAdjustmentAtRef.current = performance.now();
        requestAnimationFrame(() => {
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

            if (
                stickyBottom &&
                hasInitializedPassiveBottomRef.current &&
                !hasUserScrolledRef.current &&
                !isProgrammaticScrollRef.current &&
                scrollNode &&
                scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight) > 1
            ) {
                hasUserScrolledRef.current = true;
            }

            if (
                stickyBottom &&
                !hasUserScrolledRef.current &&
                !isProgrammaticScrollRef.current &&
                scrollNode &&
                scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight) > 1
            ) {
                scrollToBottomWhilePassive();
            }
            onScroll?.(event);
        },
        [onScroll, scrollToBottomWhilePassive, stickyBottom],
    );
    const handleVisibleRangeChange = React.useCallback(
        (range: TimelineVisibleRange): void => {
            if (stickyBottom && !hasUserScrolledRef.current && !hasInitializedPassiveBottomRef.current) {
                hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
                return;
            }
            if (stickyBottom && !hasUserScrolledRef.current) {
                return;
            }
            onVisibleRangeChange?.(range);
        },
        [onVisibleRangeChange, scrollToBottomWhilePassive, stickyBottom],
    );
    const handleTotalListHeightChanged = React.useCallback((): void => {
        const scrollNode = scrollElementRef.current;
        if (!scrollNode) {
            return;
        }

        const currentScrollHeight = scrollNode.scrollHeight;
        const previousScrollHeight = lastKnownScrollHeightRef.current;
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
        if (!scrollToBottomRequestId) {
            return;
        }

        hasUserScrolledRef.current = false;
        hasInitializedPassiveBottomRef.current = scrollToBottomWhilePassive();
    }, [scrollToBottomRequestId, scrollToBottomWhilePassive]);
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
                            lastKnownScrollHeightRef.current = element?.scrollHeight ?? 0;
                            scrollContainerRef(element);
                        }}
                        style={{
                            ...rest.style,
                            overflowAnchor: "none",
                        }}
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
        [handleScroll, markUserScrolled, scrollContainerRef],
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
                            overflowAnchor: "none",
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
                const normalizedChildren =
                    React.isValidElement(children) && typeof children.type !== "string"
                        ? React.cloneElement(children as React.ReactElement<{ as?: string }>, {
                              as: "div",
                          })
                        : children;

                return (
                    <li
                        {...(rest as unknown as React.HTMLAttributes<HTMLLIElement>)}
                        {...wrapperItemProps}
                        ref={ref as React.Ref<HTMLLIElement>}
                        style={mergedStyle}
                    >
                        {normalizedChildren}
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
            alignToBottom={stickyBottom}
            followOutput={() => (stickyBottom && !hasUserScrolledRef.current ? "auto" : false)}
            initialItemCount={items.length}
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
    const {
        scrollContainerRef,
        viewState,
        fixedChildren,
        className,
        style,
        items,
        hasTopSpinner,
        hasBottomSpinner,
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

            if (item.row && renderTimelineRow) {
                const renderedRow = withTimelineItemDomId(renderTimelineRow(item.row), item);

                if (
                    React.isValidElement(renderedRow) &&
                    typeof renderedRow.props === "object" &&
                    renderedRow.props !== null &&
                    typeof renderedRow.type !== "string"
                ) {
                    return React.cloneElement(renderedRow as React.ReactElement<{ as?: React.ElementType }>, {
                        as: "div",
                    });
                }

                return renderedRow;
            }

            return withTimelineItemDomId(item.node, item);
        },
        [renderTimelineRow],
    );
    const rootStyle = {
        ...style,
        display: "flex",
        flexDirection: "column" as const,
        minHeight: 0,
        position: "relative" as const,
    };
    const showTopSpinner = !!hasTopSpinner;
    const showBottomSpinner = !!hasBottomSpinner;

    return (
        <div
            className={classNames("mx_AutoHideScrollbar", "mx_ScrollPanel", className)}
            style={rootStyle}
            tabIndex={-1}
        >
            {fixedChildren}
            {showTopSpinner && (
                <div
                    className="mx_RoomView_messagePanelSpinner"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 1 }}
                >
                    <Spinner />
                </div>
            )}
            <div className="mx_RoomView_messageListWrapper" style={{ flex: 1, minHeight: 0 }}>
                <TimelineScrollPanelListView
                    items={items}
                    renderItem={renderItem}
                    scrollContainerRef={scrollContainerRef}
                    onScroll={props.onScroll}
                    onVisibleRangeChange={onVisibleRangeChange}
                    stickyBottom={props.stickyBottom}
                    scrollToBottomRequestId={scrollToBottomRequestId}
                    virtualListHandleRef={virtualListHandleRef}
                />
            </div>
            {showBottomSpinner && (
                <div
                    className="mx_RoomView_messagePanelSpinner"
                    style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 1 }}
                >
                    <Spinner />
                </div>
            )}
        </div>
    );
}
