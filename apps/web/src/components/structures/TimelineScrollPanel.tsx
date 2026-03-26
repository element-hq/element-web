/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";

import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { type IScrollHandle, type IScrollPanelProps, type IScrollState } from "./ScrollPanel";
import type { TimelineRow } from "./MessagePanel";
import TimelineScrollPanelView, { type TimelineScrollPanelItem } from "./TimelineScrollPanelView";
import type { VirtualizedListHandle } from "@element-hq/web-shared-components";
import {
    type TimelineScrollPanelViewSnapshot,
    type TimelineVisibleRange,
} from "../../viewmodels/timeline/TimelineScrollPanelViewModel";

const UNPAGINATION_PADDING = 6000;
const UNFILL_REQUEST_DEBOUNCE_MS = 200;

interface TimelineScrollAdapter {
    isAtBottom(): boolean;
    getScrollState(): IScrollState;
    scrollToTop(): void;
    scrollToBottom(): void;
    scrollToToken(scrollToken: string, pixelOffset?: number, offsetBase?: number): void;
    handleScrollKey(ev: React.KeyboardEvent | KeyboardEvent): void;
    checkScroll(isFromPropsUpdate?: boolean): void;
    preventShrinking(): void;
    clearPreventShrinking(): void;
    updatePreventShrinking(): void;
    getDivScroll(): HTMLDivElement | null;
}

type TimelineScrollPanelProps = IScrollPanelProps & {
    ref?: React.Ref<IScrollHandle>;
    rows?: TimelineRow[];
    renderRow?: (row: TimelineRow) => React.ReactNode;
};
type EventTimelineRow = Extract<TimelineRow, { kind: "event" }>;
type TimelineReadReceipt = NonNullable<EventTimelineRow["readReceipts"]>[number];

const TOP_SPINNER_KEY = "_topSpinner";
const BOTTOM_SPINNER_KEY = "_bottomSpinner";
function normalizeTimelineItemKey(key: string): string {
    return key.startsWith(".$") ? key.slice(2) : key;
}

function areTimelineNodePropsEquivalent(
    previousProps: Record<string, unknown>,
    nextProps: Record<string, unknown>,
): boolean {
    const ignoredProps = new Set(["ref", "children"]);
    const previousKeys = Object.keys(previousProps).filter((key) => !ignoredProps.has(key));
    const nextKeys = Object.keys(nextProps).filter((key) => !ignoredProps.has(key));

    if (previousKeys.length !== nextKeys.length) {
        return false;
    }

    return previousKeys.every((key) => Object.is(previousProps[key], nextProps[key]));
}

function areTimelineNodesEquivalent(previousNode: React.ReactNode, nextNode: React.ReactNode): boolean {
    if (previousNode === nextNode) {
        return true;
    }

    if (!React.isValidElement(previousNode) || !React.isValidElement(nextNode)) {
        return false;
    }

    return (
        previousNode.type === nextNode.type &&
        areTimelineNodePropsEquivalent(
            previousNode.props as Record<string, unknown>,
            nextNode.props as Record<string, unknown>,
        )
    );
}

function areTimelineReadReceiptsEquivalent(
    previousReceipts: TimelineReadReceipt[] | undefined,
    nextReceipts: TimelineReadReceipt[] | undefined,
): boolean {
    if (previousReceipts === nextReceipts) {
        return true;
    }

    if (!previousReceipts || !nextReceipts) {
        return false;
    }

    if (previousReceipts.length !== nextReceipts.length) {
        return false;
    }

    return previousReceipts.every((receipt, index) => {
        const nextReceipt = nextReceipts[index];
        return (
            receipt.userId === nextReceipt.userId &&
            receipt.roomMember === nextReceipt.roomMember &&
            receipt.ts === nextReceipt.ts
        );
    });
}

function areTimelineRowsEquivalent(previousRow: TimelineRow, nextRow: TimelineRow): boolean {
    if (previousRow === nextRow) {
        return true;
    }

    if (previousRow.kind !== nextRow.kind || previousRow.key !== nextRow.key) {
        return false;
    }

    switch (previousRow.kind) {
        case "opaque": {
            const nextOpaqueRow = nextRow as Extract<TimelineRow, { kind: "opaque" }>;
            return areTimelineNodesEquivalent(previousRow.node, nextOpaqueRow.node);
        }
        case "date-separator": {
            const nextDateSeparatorRow = nextRow as Extract<TimelineRow, { kind: "date-separator" }>;
            return previousRow.roomId === nextDateSeparatorRow.roomId && previousRow.ts === nextDateSeparatorRow.ts;
        }
        case "late-event-separator": {
            const nextLateEventSeparatorRow = nextRow as Extract<TimelineRow, { kind: "late-event-separator" }>;
            return previousRow.text === nextLateEventSeparatorRow.text;
        }
        case "spinner":
        case "typing-indicator":
            return true;
        case "event": {
            const nextEventRow = nextRow as EventTimelineRow;
            return (
                previousRow.event === nextEventRow.event &&
                previousRow.eventId === nextEventRow.eventId &&
                previousRow.isEditing === nextEventRow.isEditing &&
                previousRow.continuation === nextEventRow.continuation &&
                previousRow.last === nextEventRow.last &&
                previousRow.lastInSection === nextEventRow.lastInSection &&
                previousRow.lastSuccessful === nextEventRow.lastSuccessful &&
                previousRow.highlight === nextEventRow.highlight &&
                previousRow.callEventGrouper === nextEventRow.callEventGrouper &&
                areTimelineReadReceiptsEquivalent(previousRow.readReceipts, nextEventRow.readReceipts)
            );
        }
    }
}

export type TimelineScrollHandle = IScrollHandle & {
    getVisibleRange(): TimelineVisibleRange | null;
    getVisibleItemKeys(): string[] | null;
};

type ScrollRestoreTarget = { kind: "bottom" } | { kind: "anchor"; key: string; bottomOffset: number };
interface PendingScrollRequest {
    key: string;
    pixelOffset?: number;
    offsetBase?: number;
}
type LogicalScrollState =
    | { stuckAtBottom: true }
    | { stuckAtBottom: false; trackedScrollToken: string; bottomOffset: number; pixelOffset: number };

export default function TimelineScrollPanel({ ref, ...props }: TimelineScrollPanelProps): React.ReactNode {
    const { children, rows, renderRow, stickyBottom, ...restViewProps } = props;
    const viewProps = {
        ...restViewProps,
        stickyBottom,
    };
    const divScrollRef = useRef<HTMLDivElement | null>(null);
    const scrollListenerRef = useRef<((event: Event) => void) | null>(null);
    const isAtBottomRef = useRef(false);
    const logicalScrollStateRef = useRef<LogicalScrollState>({ stuckAtBottom: true });
    const visibleRangeRef = useRef<TimelineVisibleRange | null>(null);
    const pendingFillRequestsRef = useRef({ backwards: false, forwards: false });
    const edgeFillAnchorRef = useRef<{ backwards: string | null; forwards: string | null }>({
        backwards: null,
        forwards: null,
    });
    const pendingScrollAnchorRef = useRef<{ key: string; topOffset: number } | null>(null);
    const pendingRestoreTargetRef = useRef<{ target: ScrollRestoreTarget; evaluatePagination: boolean } | null>(null);
    const restoreAnimationFrameRef = useRef<number | null>(null);
    const preventShrinkingTargetRef = useRef<ScrollRestoreTarget | null>(null);
    const unfillDebouncerRef = useRef<number | null>(null);
    const itemCacheRef = useRef<Map<string, TimelineScrollPanelItem>>(new Map());
    const itemIndexByKeyRef = useRef<Map<string, number>>(new Map());
    const virtualListHandleRef = useRef<VirtualizedListHandle | null>(null);
    const pendingScrollRequestRef = useRef<PendingScrollRequest | null>(null);
    const [scrollToBottomRequestId, setScrollToBottomRequestId] = useState(0);
    const evaluatePaginationForRangeRef = useRef<(range: TimelineVisibleRange) => void>(() => {});
    const checkScrollRef = useRef<(isFromPropsUpdate?: boolean) => void>(() => {});
    const syncWrapperStateRef = useRef<() => void>(() => {});
    const onScrollPropRef = useRef<TimelineScrollPanelProps["onScroll"]>(undefined);
    const setScrollContainerRef = useCallback((element: HTMLElement | Window | null): void => {
        const scrollNode = element instanceof HTMLDivElement ? element : null;
        if (divScrollRef.current === scrollNode) {
            return;
        }

        if (divScrollRef.current && scrollListenerRef.current) {
            divScrollRef.current.removeEventListener("scroll", scrollListenerRef.current);
        }

        divScrollRef.current = scrollNode;

        if (scrollNode) {
            const handleScrollEvent = (event: Event): void => {
                syncWrapperStateRef.current();
                if (visibleRangeRef.current) {
                    evaluatePaginationForRangeRef.current(visibleRangeRef.current);
                }
                onScrollPropRef.current?.(event);
            };

            scrollListenerRef.current = handleScrollEvent;
            scrollNode.addEventListener("scroll", handleScrollEvent);
        } else {
            scrollListenerRef.current = null;
        }
    }, []);
    const rawItems: TimelineScrollPanelItem[] =
        rows && renderRow
            ? rows.map((row) => ({
                  key: normalizeTimelineItemKey(row.key),
                  row,
              }))
            : React.Children.toArray(children).map((node, index) => {
                  const key = React.isValidElement(node) && node.key !== null ? String(node.key) : String(index);
                  return {
                      key: normalizeTimelineItemKey(key),
                      node,
                  };
              });
    const rawItemsWithStableIdentity = rawItems.map((item) => {
        const previousItem = itemCacheRef.current.get(item.key);
        if (item.row) {
            if (previousItem?.row && areTimelineRowsEquivalent(previousItem.row, item.row)) {
                return previousItem;
            }

            if (previousItem?.row && previousItem.row.key === item.row.key) {
                return { ...previousItem, row: item.row };
            }
        }

        if (
            item.node !== undefined &&
            previousItem?.node !== undefined &&
            areTimelineNodesEquivalent(previousItem.node, item.node)
        ) {
            return previousItem;
        }

        return item;
    });
    itemCacheRef.current = new Map(rawItemsWithStableIdentity.map((item) => [item.key, item]));
    const hasTopSpinner = rawItemsWithStableIdentity.some((item) => item.key === TOP_SPINNER_KEY);
    const hasBottomSpinner = rawItemsWithStableIdentity.some((item) => item.key === BOTTOM_SPINNER_KEY);
    const items = rawItemsWithStableIdentity.filter(
        (item) => item.key !== TOP_SPINNER_KEY && item.key !== BOTTOM_SPINNER_KEY,
    );
    itemIndexByKeyRef.current = new Map(items.map((item, index) => [item.key, index]));
    const getVisibleItemKeys = useCallback(
        (visibleRange: TimelineVisibleRange | null): string[] | null => {
            if (!visibleRange) {
                return null;
            }

            return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item) => item.key);
        },
        [items],
    );
    const getItemIndex = useCallback((scrollToken: string): number | undefined => {
        return itemIndexByKeyRef.current.get(scrollToken);
    }, []);
    const scrollVirtualItemIntoView = useCallback(
        (index: number, align: "center" | "end" | "start" = "start"): void => {
            virtualListHandleRef.current?.scrollToIndex(index, align);
        },
        [],
    );
    const scheduleUnfill = useCallback(
        (backwards: boolean, scrollToken: string | null): void => {
            if (!scrollToken) {
                return;
            }

            if (unfillDebouncerRef.current) {
                clearTimeout(unfillDebouncerRef.current);
            }

            unfillDebouncerRef.current = window.setTimeout(() => {
                unfillDebouncerRef.current = null;
                props.onUnfillRequest?.(backwards, scrollToken);
            }, UNFILL_REQUEST_DEBOUNCE_MS);
        },
        [props],
    );
    const findNodeForToken = useCallback((scrollToken: string): HTMLElement | undefined => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return undefined;
        }

        return Array.from(scrollNode.querySelectorAll<HTMLElement>("[data-scroll-tokens]")).find((node) =>
            node.dataset.scrollTokens?.split(",").includes(scrollToken),
        );
    }, []);
    const requestFill = useCallback(
        (backwards: boolean): void => {
            const requestKey = backwards ? "backwards" : "forwards";
            if (pendingFillRequestsRef.current[requestKey]) {
                return;
            }

            if (backwards) {
                const scrollNode = divScrollRef.current;
                const trackedScrollToken =
                    logicalScrollStateRef.current.stuckAtBottom === false
                        ? logicalScrollStateRef.current.trackedScrollToken
                        : undefined;
                const trackedNode = trackedScrollToken ? findNodeForToken(trackedScrollToken) : undefined;
                if (scrollNode && trackedNode && trackedScrollToken) {
                    pendingScrollAnchorRef.current = {
                        key: trackedScrollToken,
                        topOffset: trackedNode.offsetTop - scrollNode.scrollTop,
                    };
                }
            }

            pendingFillRequestsRef.current[requestKey] = true;
            Promise.resolve(props.onFillRequest?.(backwards))
                .then((hasMoreResults) => {
                    pendingFillRequestsRef.current[requestKey] = false;

                    if (!hasMoreResults) {
                        return;
                    }

                    const visibleRange = visibleRangeRef.current;
                    if (visibleRange) {
                        evaluatePaginationForRangeRef.current(visibleRange);
                    } else {
                        checkScrollRef.current(true);
                    }
                })
                .finally(() => {
                    pendingFillRequestsRef.current[requestKey] = false;
                });
        },
        [findNodeForToken, props],
    );
    const getVirtualAlign = useCallback((offsetBase?: number): "center" | "end" | "start" => {
        if (offsetBase === 1) {
            return "end";
        }
        if (offsetBase === undefined || offsetBase === 0) {
            return "start";
        }
        return "center";
    }, []);
    const getRenderableNodes = useCallback((): HTMLElement[] => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return [];
        }

        return Array.from(scrollNode.querySelectorAll<HTMLElement>("[data-scroll-tokens]"));
    }, []);
    const topFromBottom = useCallback((node: HTMLElement, scrollNode: HTMLDivElement): number => {
        return scrollNode.scrollHeight - node.offsetTop;
    }, []);
    const findTrackedNode = useCallback(
        (scrollNode: HTMLDivElement): HTMLElement | undefined => {
            if (logicalScrollStateRef.current.stuckAtBottom === false) {
                const trackedNode = findNodeForToken(logicalScrollStateRef.current.trackedScrollToken);
                if (trackedNode) {
                    return trackedNode;
                }
            }

            const viewportBottom = scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight);
            const nodes = Array.from(scrollNode.querySelectorAll<HTMLElement>("[data-scroll-tokens]"));

            let trackedNode: HTMLElement | undefined;
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                trackedNode = node;
                if (topFromBottom(node, scrollNode) > viewportBottom) {
                    break;
                }
            }

            return trackedNode;
        },
        [findNodeForToken, topFromBottom],
    );
    const saveScrollState = useCallback((): void => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return;
        }

        if (stickyBottom && isAtBottomRef.current) {
            logicalScrollStateRef.current = { stuckAtBottom: true };
            return;
        }

        const trackedNode = findTrackedNode(scrollNode);
        const trackedScrollToken = trackedNode?.dataset.scrollTokens?.split(",")[0];
        if (!trackedNode || !trackedScrollToken) {
            return;
        }

        const viewportBottom = scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight);
        const bottomOffset = topFromBottom(trackedNode, scrollNode);

        logicalScrollStateRef.current = {
            trackedScrollToken,
            bottomOffset,
            pixelOffset: bottomOffset - viewportBottom,
            stuckAtBottom: false,
        };
    }, [findTrackedNode, stickyBottom, topFromBottom]);

    const syncIsAtBottom = useCallback((): void => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            isAtBottomRef.current = false;
            return;
        }

        isAtBottomRef.current = scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight) <= 1;
    }, []);

    const syncWrapperState = useCallback((): void => {
        syncIsAtBottom();
        saveScrollState();
    }, [saveScrollState, syncIsAtBottom]);
    syncWrapperStateRef.current = syncWrapperState;
    const tryResolvePendingScrollRequest = useCallback((): boolean => {
        const pendingScrollRequest = pendingScrollRequestRef.current;
        const scrollNode = divScrollRef.current;
        if (!pendingScrollRequest || !scrollNode) {
            return false;
        }

        const trackedNode = findNodeForToken(pendingScrollRequest.key);
        if (!trackedNode) {
            return false;
        }

        const baseOffset = pendingScrollRequest.offsetBase ?? 0;
        scrollNode.scrollTop =
            trackedNode.offsetTop - scrollNode.clientHeight * baseOffset + (pendingScrollRequest.pixelOffset ?? 0);
        pendingScrollRequestRef.current = null;
        syncWrapperState();
        return true;
    }, [findNodeForToken, syncWrapperState]);
    const captureScrollRestoreTarget = useCallback((): ScrollRestoreTarget | null => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return null;
        }

        syncWrapperState();

        if (stickyBottom && isAtBottomRef.current) {
            return { kind: "bottom" };
        }

        if (logicalScrollStateRef.current.stuckAtBottom) {
            return null;
        }

        return {
            kind: "anchor",
            key: logicalScrollStateRef.current.trackedScrollToken,
            bottomOffset: logicalScrollStateRef.current.bottomOffset,
        };
    }, [stickyBottom, syncWrapperState]);
    const restoreScrollTarget = useCallback(
        (target: ScrollRestoreTarget): boolean => {
            const scrollNode = divScrollRef.current;
            if (!scrollNode) {
                return false;
            }

            if (target.kind === "bottom") {
                scrollNode.scrollTop = scrollNode.scrollHeight;
                syncWrapperState();
                return true;
            }

            const trackedNode = findNodeForToken(target.key);
            if (!trackedNode) {
                return false;
            }

            const newBottomOffset = topFromBottom(trackedNode, scrollNode);
            scrollNode.scrollBy(0, newBottomOffset - target.bottomOffset);
            syncWrapperState();
            return true;
        },
        [findNodeForToken, syncWrapperState, topFromBottom],
    );
    const tryResolvePendingRestoreTarget = useCallback((): boolean => {
        const pendingRestoreTarget = pendingRestoreTargetRef.current;
        if (!pendingRestoreTarget) {
            return false;
        }

        if (restoreScrollTarget(pendingRestoreTarget.target)) {
            pendingRestoreTargetRef.current = null;
            if (pendingRestoreTarget.evaluatePagination && visibleRangeRef.current) {
                evaluatePaginationForRangeRef.current(visibleRangeRef.current);
            }
            return true;
        }

        if (pendingRestoreTarget.target.kind === "anchor") {
            const itemIndex = getItemIndex(pendingRestoreTarget.target.key);
            if (itemIndex !== undefined) {
                scrollVirtualItemIntoView(itemIndex, "end");
            }
        }

        return false;
    }, [getItemIndex, restoreScrollTarget, scrollVirtualItemIntoView]);
    const scheduleRestore = useCallback(
        (target: ScrollRestoreTarget, evaluatePagination: boolean): void => {
            pendingRestoreTargetRef.current = { target, evaluatePagination };

            if (restoreAnimationFrameRef.current !== null) {
                cancelAnimationFrame(restoreAnimationFrameRef.current);
            }

            restoreAnimationFrameRef.current = requestAnimationFrame(() => {
                restoreAnimationFrameRef.current = null;
                void tryResolvePendingRestoreTarget();
            });
        },
        [tryResolvePendingRestoreTarget],
    );
    const getExcessHeight = useCallback((backwards: boolean): number => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return 0;
        }

        if (backwards) {
            return scrollNode.scrollTop - scrollNode.clientHeight - UNPAGINATION_PADDING;
        }

        return scrollNode.scrollHeight - (scrollNode.scrollTop + 2 * scrollNode.clientHeight) - UNPAGINATION_PADDING;
    }, []);
    const getUnfillPaginationToken = useCallback(
        (backwards: boolean): string | null => {
            const scrollNode = divScrollRef.current;
            if (!scrollNode) {
                return null;
            }

            if (!backwards && stickyBottom && isAtBottomRef.current) {
                return null;
            }

            let excessHeight = getExcessHeight(backwards);
            if (excessHeight <= 0) {
                return null;
            }

            const nodes = getRenderableNodes();
            if (!nodes.length) {
                return null;
            }

            let markerScrollToken: string | null = null;
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[backwards ? i : nodes.length - 1 - i];
                excessHeight -= node.clientHeight;
                if (node.clientHeight > excessHeight) {
                    break;
                }

                markerScrollToken = node.dataset.scrollTokens?.split(",")[0] ?? null;
            }

            return markerScrollToken;
        },
        [getExcessHeight, getRenderableNodes, stickyBottom],
    );

    const evaluatePaginationForRange = useCallback(
        (range: TimelineVisibleRange): void => {
            const scrollNode = divScrollRef.current;
            const firstVisibleNode = findNodeForToken(items[range.startIndex]?.key ?? "");
            const shouldBackPaginate =
                !!scrollNode &&
                (!firstVisibleNode || scrollNode.scrollTop - firstVisibleNode.offsetTop < scrollNode.clientHeight);
            const shouldForwardPaginate =
                !!scrollNode &&
                !(stickyBottom && isAtBottomRef.current) &&
                scrollNode.scrollHeight - scrollNode.scrollTop < scrollNode.clientHeight * 2;

            const startAnchor = items[range.startIndex]?.key ?? null;
            const endAnchor = items[range.endIndex]?.key ?? null;

            if (!shouldBackPaginate) {
                edgeFillAnchorRef.current.backwards = null;
            } else if (startAnchor && edgeFillAnchorRef.current.backwards !== startAnchor) {
                edgeFillAnchorRef.current.backwards = startAnchor;
                requestFill(true);
            }

            if (!shouldForwardPaginate) {
                edgeFillAnchorRef.current.forwards = null;
            } else if (endAnchor && edgeFillAnchorRef.current.forwards !== endAnchor) {
                edgeFillAnchorRef.current.forwards = endAnchor;
                requestFill(false);
            }

            scheduleUnfill(true, getUnfillPaginationToken(true));
            scheduleUnfill(false, getUnfillPaginationToken(false));
        },
        [findNodeForToken, getUnfillPaginationToken, items, requestFill, scheduleUnfill, stickyBottom],
    );
    evaluatePaginationForRangeRef.current = evaluatePaginationForRange;
    onScrollPropRef.current = props.onScroll ? (event) => props.onScroll?.(event) : undefined;

    const setVisibleRange = useCallback(
        (range: TimelineVisibleRange): void => {
            syncWrapperState();
            visibleRangeRef.current = range;
            void tryResolvePendingScrollRequest();
            void tryResolvePendingRestoreTarget();
            evaluatePaginationForRange(range);
        },
        [evaluatePaginationForRange, syncWrapperState, tryResolvePendingRestoreTarget, tryResolvePendingScrollRequest],
    );

    const checkScroll = useCallback(
        (isFromPropsUpdate?: boolean): void => {
            const restoreTarget = captureScrollRestoreTarget();
            syncWrapperState();
            void isFromPropsUpdate;

            if (restoreTarget) {
                scheduleRestore(restoreTarget, true);
            } else if (visibleRangeRef.current) {
                evaluatePaginationForRange(visibleRangeRef.current);
            }
        },
        [captureScrollRestoreTarget, evaluatePaginationForRange, scheduleRestore, syncWrapperState],
    );
    checkScrollRef.current = checkScroll;

    const scrollToToken = useCallback(
        (scrollToken: string, pixelOffset?: number, offsetBase?: number): void => {
            const scrollNode = divScrollRef.current;
            if (!scrollNode) {
                return;
            }

            syncWrapperState();
            const itemIndex = getItemIndex(scrollToken);
            const trackedNode = findNodeForToken(scrollToken);
            if (trackedNode) {
                const baseOffset = offsetBase ?? 0;
                scrollNode.scrollTop =
                    trackedNode.offsetTop - scrollNode.clientHeight * baseOffset + (pixelOffset ?? 0);
                pendingScrollRequestRef.current = null;
            } else if (itemIndex !== undefined) {
                pendingScrollRequestRef.current = {
                    key: scrollToken,
                    pixelOffset,
                    offsetBase,
                };
                scrollVirtualItemIntoView(itemIndex, getVirtualAlign(offsetBase));
            }
            syncWrapperState();
        },
        [findNodeForToken, getItemIndex, getVirtualAlign, scrollVirtualItemIntoView, syncWrapperState],
    );

    const scrollToTop = useCallback((): void => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return;
        }

        syncWrapperState();
        scrollNode.scrollTop = 0;
        syncWrapperState();
    }, [syncWrapperState]);

    const scrollToBottom = useCallback((): void => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return;
        }

        setScrollToBottomRequestId((current) => current + 1);
        syncWrapperState();
        scrollNode.scrollTop = scrollNode.scrollHeight;
        syncWrapperState();
    }, [syncWrapperState]);

    const preventShrinking = useCallback((): void => {
        preventShrinkingTargetRef.current = captureScrollRestoreTarget();
    }, [captureScrollRestoreTarget]);

    const clearPreventShrinking = useCallback((): void => {
        preventShrinkingTargetRef.current = null;
    }, []);

    const updatePreventShrinking = useCallback((): void => {
        const preventShrinkingTarget = preventShrinkingTargetRef.current;
        if (!preventShrinkingTarget) {
            return;
        }

        scheduleRestore(preventShrinkingTarget, false);
    }, [scheduleRestore]);

    const scrollRelative = useCallback(
        (multiple: -1 | 1): void => {
            const scrollNode = divScrollRef.current;
            if (!scrollNode) {
                return;
            }

            const delta = multiple * scrollNode.clientHeight * 0.9;
            scrollNode.scrollBy(0, delta);
            saveScrollState();
        },
        [saveScrollState],
    );

    const adapter = useMemo<TimelineScrollAdapter>(
        () => ({
            isAtBottom: () => isAtBottomRef.current,
            getScrollState: () => {
                if (logicalScrollStateRef.current.stuckAtBottom) {
                    return { stuckAtBottom: true };
                }

                return {
                    ...logicalScrollStateRef.current,
                    trackedNode: findNodeForToken(logicalScrollStateRef.current.trackedScrollToken),
                };
            },
            scrollToTop,
            scrollToBottom,
            scrollToToken,
            handleScrollKey: (ev) => {
                const roomAction = getKeyBindingsManager().getRoomAction(ev);
                switch (roomAction) {
                    case KeyBindingAction.ScrollUp:
                        scrollRelative(-1);
                        break;
                    case KeyBindingAction.ScrollDown:
                        scrollRelative(1);
                        break;
                    case KeyBindingAction.JumpToFirstMessage:
                        adapter.scrollToTop();
                        break;
                    case KeyBindingAction.JumpToLatestMessage:
                        adapter.scrollToBottom();
                        break;
                    default:
                        break;
                }
            },
            checkScroll,
            preventShrinking,
            clearPreventShrinking,
            updatePreventShrinking,
            getDivScroll: () => divScrollRef.current,
        }),
        [
            checkScroll,
            clearPreventShrinking,
            findNodeForToken,
            preventShrinking,
            scrollRelative,
            scrollToBottom,
            scrollToToken,
            scrollToTop,
            updatePreventShrinking,
        ],
    );

    useEffect(() => {
        syncWrapperState();
    }, [syncWrapperState]);

    useLayoutEffect(() => {
        const anchor = pendingScrollAnchorRef.current;
        const scrollNode = divScrollRef.current;
        if (!anchor || !scrollNode) {
            return;
        }

        const anchoredNode = Array.from(scrollNode.querySelectorAll<HTMLElement>("[data-scroll-tokens]")).find((node) =>
            node.dataset.scrollTokens?.split(",").includes(anchor.key),
        );
        if (!anchoredNode) {
            return;
        }

        scrollNode.scrollTop = anchoredNode.offsetTop - anchor.topOffset;
        pendingScrollAnchorRef.current = null;
        syncWrapperState();
    }, [items, syncWrapperState]);

    useLayoutEffect(() => {
        void tryResolvePendingScrollRequest();
        void tryResolvePendingRestoreTarget();
        checkScroll(true);
        updatePreventShrinking();
    }, [checkScroll, items, tryResolvePendingRestoreTarget, tryResolvePendingScrollRequest, updatePreventShrinking]);

    useEffect(() => {
        return () => {
            if (divScrollRef.current && scrollListenerRef.current) {
                divScrollRef.current.removeEventListener("scroll", scrollListenerRef.current);
            }
            divScrollRef.current = null;
            if (restoreAnimationFrameRef.current !== null) {
                cancelAnimationFrame(restoreAnimationFrameRef.current);
            }
            if (unfillDebouncerRef.current) {
                clearTimeout(unfillDebouncerRef.current);
            }
        };
    }, []);

    useImperativeHandle(
        ref,
        (): TimelineScrollHandle => ({
            isAtBottom: () => adapter.isAtBottom(),
            getScrollState: () => adapter.getScrollState(),
            scrollToTop: () => adapter.scrollToTop(),
            scrollToBottom: () => adapter.scrollToBottom(),
            scrollToToken: (scrollToken, pixelOffset, offsetBase) =>
                adapter.scrollToToken(scrollToken, pixelOffset, offsetBase),
            handleScrollKey: (ev) => adapter.handleScrollKey(ev),
            checkScroll: (isFromPropsUpdate) => adapter.checkScroll(isFromPropsUpdate),
            preventShrinking: () => adapter.preventShrinking(),
            clearPreventShrinking: () => adapter.clearPreventShrinking(),
            updatePreventShrinking: () => adapter.updatePreventShrinking(),
            get divScroll() {
                return adapter.getDivScroll();
            },
            getVisibleRange: () => visibleRangeRef.current,
            getVisibleItemKeys: () => getVisibleItemKeys(visibleRangeRef.current),
        }),
        [adapter, getVisibleItemKeys],
    );

    const viewState: TimelineScrollPanelViewSnapshot = {
        isAtBottom: isAtBottomRef.current,
        scrollState: adapter.getScrollState(),
        hasScrollContainer: divScrollRef.current !== null,
        visibleRange: visibleRangeRef.current,
    };

    return (
        <TimelineScrollPanelView
            {...viewProps}
            scrollContainerRef={setScrollContainerRef}
            onVisibleRangeChange={setVisibleRange}
            viewState={viewState}
            items={items}
            hasTopSpinner={hasTopSpinner}
            hasBottomSpinner={hasBottomSpinner}
            virtualListHandleRef={virtualListHandleRef}
            scrollToBottomRequestId={scrollToBottomRequestId}
            renderTimelineRow={renderRow}
        />
    );
}
