/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect } from "react";

import {
    canSnapToBottom,
    findTimelineItemElement,
    getBottomOffset,
    getLastVisibleTimelineItemElement,
    getTopOffset,
} from "./TimelineViewDom";
import type { PaginationState, TimelineItem, VisibleRange } from "./types";

type InitialFillState = "filling" | "settling" | "done";

function getShiftedRangeAnchorCandidate<TItem extends TimelineItem>({
    items,
    visibleRange,
    scrollerElement,
    reason,
}: {
    items: TItem[];
    visibleRange: VisibleRange | null;
    scrollerElement: HTMLElement | null;
    reason: string;
}): { key: string | null; topOffsetPx: number | null; bottomOffsetPx: number | null } {
    if (!scrollerElement || !visibleRange) {
        return { key: null, topOffsetPx: null, bottomOffsetPx: null };
    }

    const startIndex = Math.max(0, Math.min(items.length - 1, visibleRange.startIndex));
    const endIndex = Math.max(startIndex, Math.min(items.length - 1, visibleRange.endIndex));
    const visibleLength = endIndex - startIndex + 1;
    const preferredIndexWithinRange = reason === "at-bottom state change" ? Math.max(0, visibleLength - 1) : 0;
    const anchorIndex = Math.min(endIndex, startIndex + preferredIndexWithinRange);
    const anchorKey = items[anchorIndex]?.key ?? null;
    const anchorElement = anchorKey ? findTimelineItemElement(scrollerElement, anchorKey) : null;

    if (!anchorElement) {
        return { key: null, topOffsetPx: null, bottomOffsetPx: null };
    }

    return {
        key: anchorKey,
        topOffsetPx: getTopOffset(scrollerElement, anchorElement),
        bottomOffsetPx: getBottomOffset(scrollerElement, anchorElement),
    };
}

/**
 * Captures the DOM state needed to restore visual continuity after a forward
 * pagination request completes.
 */
export interface ForwardPaginationContext {
    continuityMode: "anchor" | "bottom" | "shifted-range";
    requestReason: string;
    anchorKey: string | null;
    lastVisibleRange: VisibleRange | null;
    bottomOffsetPx: number | null;
    shiftedRangeAnchorKey: string | null;
    shiftedRangeTopOffsetPx: number | null;
    shiftedRangeBottomOffsetPx: number | null;
    requestedAtLiveEdge: boolean;
    requestedWhileSeekingLiveEdge: boolean;
}

interface UseTimelineForwardPaginationParams<TItem extends TimelineItem> {
    items: TItem[];
    initialFillState: InitialFillState;
    scrollerElement: HTMLElement | null;
    isAtLiveEdge: boolean;
    canPaginateForward: boolean;
    forwardPagination: PaginationState;
    hasScrollTarget: boolean;
    followOutputEnabled: boolean;
    suppressForwardLiveEdgeSeekAfterAnchor: boolean;
    wasAtBottom: boolean;
    getLastVisibleRange: () => VisibleRange | null;
    getLastForwardRequestedTailKey: () => string | null;
    setLastForwardRequestedTailKey: (tailKey: string | null) => void;
    getForwardPaginationContext: () => ForwardPaginationContext | null;
    setForwardPaginationContext: (context: ForwardPaginationContext | null) => void;
    getLastBottomTriggeredForwardPaginationGesture: () => number | null;
    getScrollGestureGeneration: () => number;
    setWasAtBottom: (wasAtBottom: boolean) => void;
    onRequestMoreItems: () => void;
}

/**
 * Captures forward-pagination continuity state at request time and drives the
 * "keep seeking live edge" request loop once appended items have rendered.
 */
export function useTimelineForwardPagination<TItem extends TimelineItem>({
    items,
    initialFillState,
    scrollerElement,
    isAtLiveEdge,
    canPaginateForward,
    forwardPagination,
    hasScrollTarget,
    followOutputEnabled,
    suppressForwardLiveEdgeSeekAfterAnchor,
    wasAtBottom,
    getLastVisibleRange,
    getLastForwardRequestedTailKey,
    setLastForwardRequestedTailKey,
    getForwardPaginationContext,
    setForwardPaginationContext,
    getLastBottomTriggeredForwardPaginationGesture,
    getScrollGestureGeneration,
    setWasAtBottom,
    onRequestMoreItems,
}: UseTimelineForwardPaginationParams<TItem>): {
    requestForwardPagination: (reason: string) => boolean;
} {
    const requestForwardPagination = useCallback(
        (reason: string) => {
            const tailKey = items.at(-1)?.key ?? null;
            if (!tailKey || getLastForwardRequestedTailKey() === tailKey) {
                return false;
            }

            setLastForwardRequestedTailKey(tailKey);
            const visibleRange = getLastVisibleRange();
            const anchorElement = scrollerElement ? getLastVisibleTimelineItemElement(scrollerElement) : null;
            const continuityMode: ForwardPaginationContext["continuityMode"] =
                reason === "live-edge auto paginate" || reason === "post-forward continue seeking live edge"
                    ? "bottom"
                    : reason === "at-bottom state change"
                      ? "shifted-range"
                      : "anchor";
            const shiftedRangeAnchorCandidate = getShiftedRangeAnchorCandidate({
                items,
                visibleRange,
                scrollerElement,
                reason,
            });
            const shiftedRangeAnchorElement =
                shiftedRangeAnchorCandidate.key && scrollerElement
                    ? findTimelineItemElement(scrollerElement, shiftedRangeAnchorCandidate.key)
                    : null;

            setForwardPaginationContext({
                continuityMode,
                requestReason: reason,
                anchorKey: anchorElement?.dataset.timelineItemKey ?? null,
                lastVisibleRange: visibleRange,
                bottomOffsetPx:
                    scrollerElement && anchorElement ? getBottomOffset(scrollerElement, anchorElement) : null,
                shiftedRangeAnchorKey:
                    shiftedRangeAnchorCandidate.key ?? shiftedRangeAnchorElement?.dataset.timelineItemKey ?? null,
                shiftedRangeTopOffsetPx:
                    shiftedRangeAnchorCandidate.topOffsetPx ??
                    (scrollerElement && shiftedRangeAnchorElement
                        ? getTopOffset(scrollerElement, shiftedRangeAnchorElement)
                        : null),
                shiftedRangeBottomOffsetPx:
                    shiftedRangeAnchorCandidate.bottomOffsetPx ??
                    (scrollerElement && shiftedRangeAnchorElement
                        ? getBottomOffset(scrollerElement, shiftedRangeAnchorElement)
                        : null),
                requestedAtLiveEdge: isAtLiveEdge,
                requestedWhileSeekingLiveEdge: followOutputEnabled,
            });
            onRequestMoreItems();
            return true;
        },
        [
            followOutputEnabled,
            getLastForwardRequestedTailKey,
            getLastVisibleRange,
            isAtLiveEdge,
            items,
            onRequestMoreItems,
            scrollerElement,
            setForwardPaginationContext,
            setLastForwardRequestedTailKey,
        ],
    );

    useEffect(() => {
        if (
            initialFillState !== "done" ||
            !isAtLiveEdge ||
            !canPaginateForward ||
            forwardPagination !== "idle" ||
            !followOutputEnabled ||
            suppressForwardLiveEdgeSeekAfterAnchor ||
            hasScrollTarget ||
            !scrollerElement ||
            scrollerElement.clientHeight <= 0
        ) {
            return;
        }

        if (!wasAtBottom && !canSnapToBottom(scrollerElement)) {
            return;
        }

        requestForwardPagination("live-edge auto paginate");
    }, [
        canPaginateForward,
        followOutputEnabled,
        forwardPagination,
        hasScrollTarget,
        initialFillState,
        isAtLiveEdge,
        requestForwardPagination,
        scrollerElement,
        suppressForwardLiveEdgeSeekAfterAnchor,
        wasAtBottom,
    ]);

    useEffect(() => {
        const currentTailKey = items.at(-1)?.key ?? null;
        if (currentTailKey !== getLastForwardRequestedTailKey()) {
            setLastForwardRequestedTailKey(null);
        }

        if (!isAtLiveEdge && canPaginateForward) {
            setWasAtBottom(false);
        }

        if (!scrollerElement) {
            return;
        }

        let cancelled = false;
        const frameId = window.requestAnimationFrame(() => {
            if (cancelled) {
                return;
            }

            const snapToBottomAfterLayout = canSnapToBottom(scrollerElement);
            const shouldContinueSeekingLiveEdge =
                forwardPagination === "idle" &&
                initialFillState === "done" &&
                !hasScrollTarget &&
                !isAtLiveEdge &&
                canPaginateForward &&
                followOutputEnabled &&
                !suppressForwardLiveEdgeSeekAfterAnchor &&
                snapToBottomAfterLayout;
            if (shouldContinueSeekingLiveEdge) {
                requestForwardPagination("post-forward continue seeking live edge");
            }
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
        };
    }, [
        canPaginateForward,
        followOutputEnabled,
        forwardPagination,
        getForwardPaginationContext,
        getLastBottomTriggeredForwardPaginationGesture,
        getLastForwardRequestedTailKey,
        getScrollGestureGeneration,
        hasScrollTarget,
        initialFillState,
        isAtLiveEdge,
        items,
        requestForwardPagination,
        scrollerElement,
        setLastForwardRequestedTailKey,
        setWasAtBottom,
        suppressForwardLiveEdgeSeekAfterAnchor,
    ]);

    return {
        requestForwardPagination,
    };
}
