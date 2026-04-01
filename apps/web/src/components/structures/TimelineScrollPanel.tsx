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

const ANCHOR_OFFSET_EQUIVALENCE_PX = 24;
const BOTTOM_DETECTION_EQUIVALENCE_PX = 48;
const RESIZE_RESTORE_OFFSET_BUCKET_PX = 32;
const RESIZE_RESTORE_VISIBLE_MARGIN_FACTOR = 1;
const RESIZE_RESTORE_MIN_DELTA_PX = 96;

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

function normalizeTimelineItemKey(key: string): string {
    return key.startsWith(".$") ? key.slice(2) : key;
}

function sanitizeTimelineIdentityPart(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function bucketOffset(offset: number, bucketSize: number): number {
    return Math.round(offset / bucketSize) * bucketSize;
}

function getTimelineItemIdentityNamespace(item: Pick<TimelineScrollPanelItem, "key" | "row">): string {
    return item.row ? item.row.kind : "item";
}

function dedupeTimelineIdentity(baseIdentity: string, seenIdentities: Map<string, number>): string {
    const seenCount = seenIdentities.get(baseIdentity) ?? 0;
    seenIdentities.set(baseIdentity, seenCount + 1);

    return seenCount === 0 ? baseIdentity : `${baseIdentity}#${seenCount + 1}`;
}

function countSharedSuffix(previous: string[], next: string[]): number {
    const limit = Math.min(previous.length, next.length);
    let count = 0;
    while (count < limit && previous[previous.length - 1 - count] === next[next.length - 1 - count]) {
        count += 1;
    }
    return count;
}

function areStringArraysEqual(previous: string[] | null | undefined, next: string[]): boolean {
    if (!previous || previous.length !== next.length) {
        return false;
    }

    return previous.every((value, index) => value === next[index]);
}

function withSynthesizedTimelineIdentity(items: TimelineScrollPanelItem[]): TimelineScrollPanelItem[] {
    const seenIdentities = new Map<string, number>();

    return items.map((item) => {
        const baseIdentity = `${getTimelineItemIdentityNamespace(item)}:${item.key}`;
        const panelIdentity = dedupeTimelineIdentity(baseIdentity, seenIdentities);

        return {
            ...item,
            virtualKey: panelIdentity,
            domId: `mx_TimelinePanel_${sanitizeTimelineIdentityPart(panelIdentity)}`,
        };
    });
}

export type TimelineScrollHandle = IScrollHandle & {
    getVisibleRange(): TimelineVisibleRange | null;
    getVisibleItemKeys(): string[] | null;
};

type ScrollRestoreTarget =
    | { kind: "bottom" }
    | { kind: "anchor"; key: string; bottomOffset?: number; topOffset?: number };

function areScrollRestoreTargetsEquivalent(
    previousTarget: ScrollRestoreTarget | null | undefined,
    nextTarget: ScrollRestoreTarget | null | undefined,
): boolean {
    if (previousTarget === nextTarget) {
        return true;
    }

    if (!previousTarget || !nextTarget || previousTarget.kind !== nextTarget.kind) {
        return false;
    }

    if (previousTarget.kind === "bottom") {
        return true;
    }

    const previousAnchorTarget = previousTarget as Extract<ScrollRestoreTarget, { kind: "anchor" }>;
    const nextAnchorTarget = nextTarget as Extract<ScrollRestoreTarget, { kind: "anchor" }>;

    const bottomOffsetsEquivalent =
        previousAnchorTarget.bottomOffset === undefined || nextAnchorTarget.bottomOffset === undefined
            ? true
            : Math.abs(previousAnchorTarget.bottomOffset - nextAnchorTarget.bottomOffset) <=
              ANCHOR_OFFSET_EQUIVALENCE_PX;
    const topOffsetsEquivalent =
        previousAnchorTarget.topOffset === undefined || nextAnchorTarget.topOffset === undefined
            ? true
            : Math.abs(previousAnchorTarget.topOffset - nextAnchorTarget.topOffset) <= ANCHOR_OFFSET_EQUIVALENCE_PX;

    return previousAnchorTarget.key === nextAnchorTarget.key && bottomOffsetsEquivalent && topOffsetsEquivalent;
}

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
    const skipNextPropsRestoreRef = useRef(false);
    const pendingRestoreTargetRef = useRef<{ target: ScrollRestoreTarget; evaluatePagination: boolean } | null>(null);
    const lastResolvedRestoreTargetRef = useRef<ScrollRestoreTarget | null>(null);
    const lastScheduledResizeRestoreTargetRef = useRef<ScrollRestoreTarget | null>(null);
    const restoreAnimationFrameRef = useRef<number | null>(null);
    const resizeRestoreTimeoutRef = useRef<number | null>(null);
    const preventShrinkingTargetRef = useRef<ScrollRestoreTarget | null>(null);
    const itemCacheRef = useRef<Map<string, TimelineScrollPanelItem>>(new Map());
    const previousItemsRef = useRef<TimelineScrollPanelItem[]>([]);
    const previousItemOrderRef = useRef<string[] | null>(null);
    const itemIndexByKeyRef = useRef<Map<string, number>>(new Map());
    const mountedElementsByTokenRef = useRef<Map<string, Set<HTMLElement>>>(new Map());
    const tokensByElementRef = useRef<WeakMap<HTMLElement, string[]>>(new WeakMap());
    const virtualListHandleRef = useRef<VirtualizedListHandle | null>(null);
    const pendingScrollRequestRef = useRef<PendingScrollRequest | null>(null);
    const suppressNextPropsRestoreRef = useRef(false);
    const lastCommittedItemKeysRef = useRef<string[]>([]);
    const [scrollToBottomRequestId, setScrollToBottomRequestId] = useState(0);
    const evaluatePaginationForRangeRef = useRef<(range: TimelineVisibleRange) => void>(() => {});
    const checkScrollRef = useRef<(isFromPropsUpdate?: boolean) => void>(() => {});
    const syncWrapperStateRef = useRef<() => void>(() => {});
    const scheduleOppositeEdgeUnfillRef = useRef<(filledBackwards: boolean) => void>(() => {});
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
                void event;
            };

            scrollListenerRef.current = handleScrollEvent;
            scrollNode.addEventListener("scroll", handleScrollEvent);
        } else {
            scrollListenerRef.current = null;
        }
    }, []);
    const rawItems: TimelineScrollPanelItem[] = withSynthesizedTimelineIdentity(
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
              }),
    );
    const rawItemsWithStableIdentity = rawItems.map((item) => {
        const previousItem = itemCacheRef.current.get(item.virtualKey ?? item.key);
        if (previousItem && (previousItem.row === item.row || previousItem.node === item.node)) {
            return previousItem;
        }

        return item;
    });
    itemCacheRef.current = new Map<string, TimelineScrollPanelItem>(
        rawItemsWithStableIdentity.map((item) => [item.virtualKey ?? item.key, item] as const),
    );
    const items =
        rawItemsWithStableIdentity.length === previousItemsRef.current.length &&
        rawItemsWithStableIdentity.every((item, index) => item === previousItemsRef.current[index])
            ? previousItemsRef.current
            : rawItemsWithStableIdentity;
    previousItemsRef.current = items;
    const currentItemKeys = items.map((item) => item.virtualKey ?? item.key);
    itemIndexByKeyRef.current = new Map(
        items.flatMap((item, index) =>
            item.row?.kind === "event" ? [[(item.row as EventTimelineRow).eventId, index] as const] : [],
        ),
    );
    const getVisibleItemKeys = useCallback(
        (visibleRange: TimelineVisibleRange | null): string[] | null => {
            if (!visibleRange) {
                return null;
            }

            const visibleKeys: string[] = [];
            for (let index = visibleRange.startIndex; index <= visibleRange.endIndex; index++) {
                const item = items[index];
                if (item) {
                    visibleKeys.push(item.key);
                }
            }
            return visibleKeys;
        },
        [items],
    );
    const updateElementRegistration = useCallback((element: HTMLElement, nextTokens: string[]): void => {
        const previousTokens = tokensByElementRef.current.get(element) ?? [];

        for (const token of previousTokens) {
            if (nextTokens.includes(token)) {
                continue;
            }

            const elements = mountedElementsByTokenRef.current.get(token);
            if (!elements) {
                continue;
            }

            elements.delete(element);
            if (elements.size === 0) {
                mountedElementsByTokenRef.current.delete(token);
            }
        }

        for (const token of nextTokens) {
            let elements = mountedElementsByTokenRef.current.get(token);
            if (!elements) {
                elements = new Set();
                mountedElementsByTokenRef.current.set(token, elements);
            }
            elements.add(element);
        }

        tokensByElementRef.current.set(element, nextTokens);
    }, []);
    const unregisterElement = useCallback((element: HTMLElement): void => {
        const tokens = tokensByElementRef.current.get(element) ?? [];
        for (const token of tokens) {
            const elements = mountedElementsByTokenRef.current.get(token);
            if (!elements) {
                continue;
            }

            elements.delete(element);
            if (elements.size === 0) {
                mountedElementsByTokenRef.current.delete(token);
            }
        }
    }, []);
    const handleItemElementChange = useCallback(
        (
            _item: TimelineScrollPanelItem | undefined,
            previousElement: HTMLLIElement | null,
            nextElement: HTMLLIElement | null,
        ): void => {
            if (previousElement && previousElement !== nextElement) {
                unregisterElement(previousElement);
            }

            if (!nextElement) {
                return;
            }

            const tokens = nextElement.dataset.scrollTokens?.split(",").filter(Boolean) ?? [];
            updateElementRegistration(nextElement, tokens);
        },
        [unregisterElement, updateElementRegistration],
    );
    const getItemIndex = useCallback((scrollToken: string): number | undefined => {
        return itemIndexByKeyRef.current.get(scrollToken);
    }, []);
    const canResolvePendingRestoreTargetForRange = useCallback(
        (range: TimelineVisibleRange): boolean => {
            const pendingRestoreTarget = pendingRestoreTargetRef.current;
            if (!pendingRestoreTarget) {
                return false;
            }

            if (pendingRestoreTarget.target.kind === "bottom") {
                return true;
            }

            const itemIndex = getItemIndex(pendingRestoreTarget.target.key);
            if (itemIndex === undefined) {
                return false;
            }

            return itemIndex >= range.startIndex && itemIndex <= range.endIndex;
        },
        [getItemIndex],
    );
    const scrollVirtualItemIntoView = useCallback(
        (index: number, align: "center" | "end" | "start" = "start"): void => {
            virtualListHandleRef.current?.scrollToIndex(index, align);
        },
        [],
    );
    const findNodeForToken = useCallback((scrollToken: string): HTMLElement | undefined => {
        const matchingNodes = mountedElementsByTokenRef.current.get(scrollToken);
        if (!matchingNodes?.size) {
            return undefined;
        }

        return Array.from(matchingNodes).reduce((bestNode, node) => {
            const bestTokenCount = bestNode.dataset.scrollTokens?.split(",").length ?? Number.MAX_SAFE_INTEGER;
            const tokenCount = node.dataset.scrollTokens?.split(",").length ?? Number.MAX_SAFE_INTEGER;

            return tokenCount < bestTokenCount ? node : bestNode;
        });
    }, []);
    const getRenderableNodes = useCallback((): HTMLElement[] => {
        const renderableNodes = new Set<HTMLElement>();
        mountedElementsByTokenRef.current.forEach((elements) => {
            elements.forEach((element) => {
                renderableNodes.add(element);
            });
        });
        return Array.from(renderableNodes).sort((first, second) => first.offsetTop - second.offsetTop);
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

                    suppressNextPropsRestoreRef.current = true;

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
    const topFromBottom = useCallback((node: HTMLElement, scrollNode: HTMLDivElement): number => {
        return scrollNode.scrollHeight - node.offsetTop;
    }, []);
    const topFromTop = useCallback((node: HTMLElement, scrollNode: HTMLDivElement): number => {
        return node.offsetTop - scrollNode.scrollTop;
    }, []);
    const isNodeVisibleInViewport = useCallback((node: HTMLElement, scrollNode: HTMLDivElement): boolean => {
        const viewportTop = scrollNode.scrollTop;
        const viewportBottom = viewportTop + scrollNode.clientHeight;
        const nodeTop = node.offsetTop;
        const nodeBottom = nodeTop + node.clientHeight;

        return nodeBottom > viewportTop && nodeTop < viewportBottom;
    }, []);
    const isNodeComfortablyVisibleInViewport = useCallback((node: HTMLElement, scrollNode: HTMLDivElement): boolean => {
        const margin = scrollNode.clientHeight * RESIZE_RESTORE_VISIBLE_MARGIN_FACTOR;
        const viewportTop = scrollNode.scrollTop;
        const viewportBottom = viewportTop + scrollNode.clientHeight;
        const nodeTop = node.offsetTop;
        const nodeBottom = nodeTop + node.clientHeight;

        return nodeBottom > viewportTop - margin && nodeTop < viewportBottom + margin;
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
            const nodes = getRenderableNodes();

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
        [findNodeForToken, getRenderableNodes, topFromBottom],
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

        isAtBottomRef.current =
            scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight) <=
            BOTTOM_DETECTION_EQUIVALENCE_PX;
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

        if (stickyBottom && logicalScrollStateRef.current.stuckAtBottom) {
            return { kind: "bottom" };
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
    const captureResizeRestoreTarget = useCallback((): ScrollRestoreTarget | null => {
        const scrollNode = divScrollRef.current;
        if (!scrollNode) {
            return null;
        }

        if (stickyBottom && logicalScrollStateRef.current.stuckAtBottom) {
            return { kind: "bottom" };
        }

        syncWrapperState();

        if (stickyBottom && isAtBottomRef.current) {
            return { kind: "bottom" };
        }

        if (logicalScrollStateRef.current.stuckAtBottom) {
            return null;
        }

        const trackedNode = findNodeForToken(logicalScrollStateRef.current.trackedScrollToken);
        if (!trackedNode) {
            return null;
        }

        return {
            kind: "anchor",
            key: logicalScrollStateRef.current.trackedScrollToken,
            topOffset: bucketOffset(topFromTop(trackedNode, scrollNode), RESIZE_RESTORE_OFFSET_BUCKET_PX),
        };
    }, [findNodeForToken, stickyBottom, syncWrapperState, topFromTop]);
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

            if (target.topOffset !== undefined) {
                scrollNode.scrollTop = trackedNode.offsetTop - target.topOffset;
                syncWrapperState();
                return true;
            }

            const newBottomOffset = topFromBottom(trackedNode, scrollNode);
            scrollNode.scrollBy(0, newBottomOffset - (target.bottomOffset ?? newBottomOffset));
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
            lastResolvedRestoreTargetRef.current = pendingRestoreTarget.target;
            lastScheduledResizeRestoreTargetRef.current = null;
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
            const pendingRestoreTarget = pendingRestoreTargetRef.current;
            if (
                pendingRestoreTarget &&
                pendingRestoreTarget.evaluatePagination === evaluatePagination &&
                areScrollRestoreTargetsEquivalent(pendingRestoreTarget.target, target)
            ) {
                return;
            }

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
    const scheduleResizeRestore = useCallback(
        (target: ScrollRestoreTarget, evaluatePagination: boolean): void => {
            if (
                target.kind === "anchor" &&
                lastScheduledResizeRestoreTargetRef.current?.kind === "anchor" &&
                lastScheduledResizeRestoreTargetRef.current.key === target.key
            ) {
                const previousOffset =
                    lastScheduledResizeRestoreTargetRef.current.topOffset ??
                    lastScheduledResizeRestoreTargetRef.current.bottomOffset;
                const nextOffset = target.topOffset ?? target.bottomOffset;

                if (
                    previousOffset !== undefined &&
                    nextOffset !== undefined &&
                    Math.abs(previousOffset - nextOffset) < RESIZE_RESTORE_MIN_DELTA_PX
                ) {
                    return;
                }
            }

            lastScheduledResizeRestoreTargetRef.current = target;

            if (resizeRestoreTimeoutRef.current !== null) {
                window.clearTimeout(resizeRestoreTimeoutRef.current);
            }

            resizeRestoreTimeoutRef.current = window.setTimeout(() => {
                resizeRestoreTimeoutRef.current = null;
                scheduleRestore(target, evaluatePagination);
            }, 32);
        },
        [scheduleRestore],
    );
    scheduleOppositeEdgeUnfillRef.current = (): void => {
        // Do not unfill in the virtualized timeline.
        // The legacy ScrollPanel computes unfill markers from the full DOM list,
        // but the virtualized list only mounts a viewport slice, so the same
        // heuristic can prune almost the entire head/tail of the backing array.
    };

    const evaluatePaginationForRange = useCallback(
        (range: TimelineVisibleRange): void => {
            const scrollNode = divScrollRef.current;
            const renderableNodes = getRenderableNodes();
            const viewportTop = scrollNode?.scrollTop ?? 0;
            const viewportBottom = viewportTop + (scrollNode?.clientHeight ?? 0);
            const viewportVisibleNodes = renderableNodes.filter((node) => {
                const nodeTop = node.offsetTop;
                const nodeBottom = nodeTop + node.clientHeight;

                return nodeBottom > viewportTop && nodeTop < viewportBottom;
            });
            const firstVisibleNode = viewportVisibleNodes[0];
            const lastVisibleNode = viewportVisibleNodes[viewportVisibleNodes.length - 1];
            const shouldBackPaginate =
                !!scrollNode &&
                (!firstVisibleNode || scrollNode.scrollTop - firstVisibleNode.offsetTop < scrollNode.clientHeight);
            const shouldForwardPaginate =
                !!scrollNode &&
                !(stickyBottom && isAtBottomRef.current) &&
                scrollNode.scrollHeight - scrollNode.scrollTop < scrollNode.clientHeight * 2;

            const startAnchor =
                firstVisibleNode?.dataset.scrollTokens?.split(",")[0] ?? items[range.startIndex]?.key ?? null;
            const endAnchor =
                lastVisibleNode?.dataset.scrollTokens?.split(",")[0] ?? items[range.endIndex]?.key ?? null;

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
        },
        [getRenderableNodes, items, requestFill, stickyBottom],
    );
    evaluatePaginationForRangeRef.current = evaluatePaginationForRange;

    const setVisibleRange = useCallback(
        (range: TimelineVisibleRange): void => {
            syncWrapperState();
            visibleRangeRef.current = range;
            void tryResolvePendingScrollRequest();
            if (canResolvePendingRestoreTargetForRange(range)) {
                void tryResolvePendingRestoreTarget();
            }
            evaluatePaginationForRange(range);
        },
        [
            canResolvePendingRestoreTargetForRange,
            evaluatePaginationForRange,
            syncWrapperState,
            tryResolvePendingRestoreTarget,
            tryResolvePendingScrollRequest,
        ],
    );

    const checkScroll = useCallback(
        (isFromPropsUpdate?: boolean): void => {
            const restoreTarget = isFromPropsUpdate ? captureScrollRestoreTarget() : captureResizeRestoreTarget();
            syncWrapperState();

            if (areScrollRestoreTargetsEquivalent(lastResolvedRestoreTargetRef.current, restoreTarget)) {
                if (visibleRangeRef.current) {
                    evaluatePaginationForRange(visibleRangeRef.current);
                }
                return;
            }

            if (restoreTarget?.kind === "anchor") {
                const scrollNode = divScrollRef.current;
                const trackedNode = scrollNode ? findNodeForToken(restoreTarget.key) : undefined;

                if (
                    scrollNode &&
                    trackedNode &&
                    (isFromPropsUpdate
                        ? isNodeVisibleInViewport(trackedNode, scrollNode)
                        : isNodeComfortablyVisibleInViewport(trackedNode, scrollNode))
                ) {
                    if (visibleRangeRef.current) {
                        evaluatePaginationForRange(visibleRangeRef.current);
                    }
                    return;
                }

                if (areScrollRestoreTargetsEquivalent(lastResolvedRestoreTargetRef.current, restoreTarget)) {
                    if (visibleRangeRef.current) {
                        evaluatePaginationForRange(visibleRangeRef.current);
                    }
                    return;
                }
            }

            if (restoreTarget) {
                if (isFromPropsUpdate) {
                    scheduleRestore(restoreTarget, true);
                } else {
                    scheduleResizeRestore(restoreTarget, true);
                }
            } else if (visibleRangeRef.current) {
                evaluatePaginationForRange(visibleRangeRef.current);
            }
        },
        [
            captureResizeRestoreTarget,
            captureScrollRestoreTarget,
            evaluatePaginationForRange,
            findNodeForToken,
            isNodeComfortablyVisibleInViewport,
            isNodeVisibleInViewport,
            scheduleResizeRestore,
            scheduleRestore,
            syncWrapperState,
        ],
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
        pendingRestoreTargetRef.current = null;
        lastScheduledResizeRestoreTargetRef.current = null;
        pendingScrollRequestRef.current = null;
        pendingScrollAnchorRef.current = null;
        logicalScrollStateRef.current = { stuckAtBottom: true };
        isAtBottomRef.current = true;
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

        const anchoredNode = findNodeForToken(anchor.key);
        if (!anchoredNode) {
            return;
        }

        scrollNode.scrollTop = anchoredNode.offsetTop - anchor.topOffset;
        pendingScrollAnchorRef.current = null;
        skipNextPropsRestoreRef.current = true;
        syncWrapperState();
    }, [findNodeForToken, items, syncWrapperState]);

    useLayoutEffect(() => {
        void tryResolvePendingScrollRequest();
        void tryResolvePendingRestoreTarget();
        const previousItemKeys = lastCommittedItemKeysRef.current;
        const sharedSuffix = countSharedSuffix(previousItemKeys, currentItemKeys);
        const previousItemKeySet = new Set(previousItemKeys);
        let overlappingKeyCount = 0;
        for (const key of currentItemKeys) {
            if (previousItemKeySet.has(key)) {
                overlappingKeyCount += 1;
            }
        }
        const prependedItemCount = currentItemKeys.length - previousItemKeys.length;
        const isPurePrependGrowth =
            previousItemKeys.length > 0 &&
            currentItemKeys.length > previousItemKeys.length &&
            sharedSuffix === previousItemKeys.length &&
            overlappingKeyCount === previousItemKeys.length &&
            prependedItemCount > 0;
        const visibleRange = visibleRangeRef.current;
        const visibleRangeSurvivesPrepend =
            !!visibleRange &&
            visibleRange.startIndex + prependedItemCount >= 0 &&
            visibleRange.endIndex + prependedItemCount < currentItemKeys.length;
        const previousItemOrder = previousItemOrderRef.current;
        previousItemOrderRef.current = currentItemKeys;
        const shouldRestoreForPropsUpdate = !areStringArraysEqual(previousItemOrder, currentItemKeys);
        if (skipNextPropsRestoreRef.current) {
            skipNextPropsRestoreRef.current = false;
            syncWrapperState();
            if (visibleRangeRef.current) {
                evaluatePaginationForRangeRef.current(visibleRangeRef.current);
            }
        } else if (shouldRestoreForPropsUpdate && suppressNextPropsRestoreRef.current) {
            suppressNextPropsRestoreRef.current = false;
            syncWrapperState();
            if (visibleRangeRef.current) {
                evaluatePaginationForRangeRef.current(visibleRangeRef.current);
            }
        } else if (shouldRestoreForPropsUpdate && isPurePrependGrowth && visibleRangeSurvivesPrepend) {
            syncWrapperState();
            if (visibleRangeRef.current) {
                evaluatePaginationForRangeRef.current(visibleRangeRef.current);
            }
        } else if (shouldRestoreForPropsUpdate) {
            checkScroll(true);
            updatePreventShrinking();
        } else {
            syncWrapperState();
            if (visibleRangeRef.current) {
                evaluatePaginationForRangeRef.current(visibleRangeRef.current);
            }
        }
        lastCommittedItemKeysRef.current = currentItemKeys;
    }, [
        checkScroll,
        currentItemKeys,
        items,
        syncWrapperState,
        tryResolvePendingRestoreTarget,
        tryResolvePendingScrollRequest,
        updatePreventShrinking,
    ]);

    useEffect(() => {
        const mountedElementsByToken = mountedElementsByTokenRef.current;
        return () => {
            if (divScrollRef.current && scrollListenerRef.current) {
                divScrollRef.current.removeEventListener("scroll", scrollListenerRef.current);
            }
            divScrollRef.current = null;
            if (restoreAnimationFrameRef.current !== null) {
                cancelAnimationFrame(restoreAnimationFrameRef.current);
            }
            if (resizeRestoreTimeoutRef.current !== null) {
                window.clearTimeout(resizeRestoreTimeoutRef.current);
            }
            mountedElementsByToken.clear();
            lastScheduledResizeRestoreTargetRef.current = null;
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
            onBeforeScrollNotify={syncWrapperState}
            onVisibleRangeChange={setVisibleRange}
            onItemElementChange={handleItemElementChange}
            viewState={viewState}
            items={items}
            virtualListHandleRef={virtualListHandleRef}
            scrollToBottomRequestId={scrollToBottomRequestId}
            renderTimelineRow={renderRow}
        />
    );
}
