/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { NavigationAnchor } from "./types";

/*
 * DOM measurement and scroll-correction helpers for `TimelineView`.
 *
 * This module contains the geometry operations that depend on the rendered
 * scroller and timeline item elements. It complements
 * `TimelineViewBehavior`, which decides when a correction should happen, by
 * answering whether the DOM is aligned and how much local adjustment is needed.
 *
 * The helpers are grouped into three areas:
 * 1. Anchor lookup and alignment checks.
 * 2. Local scroll-top correction and clamping.
 * 3. Bottom-edge and visible-item measurement used for live-edge and forward
 *    pagination continuity.
 */
const SNAP_TO_TARGET_OFFSET_EPSILON_PX = 1;
const SNAP_TO_BOTTOM_TARGET_OFFSET_EPSILON_PX = 0;
const TARGET_ALIGNMENT_SCROLL_ADJUSTMENT_EPSILON_PX = 0;

/**
 * Acceptable pixel distance from the true bottom for considering a scroller
 * close enough to snap to the live edge.
 */
export const SNAP_TO_BOTTOM_OFFSET_EPSILON_PX = 16;

// Anchor lookup and alignment -----------------------------------------------

/**
 * Finds the rendered DOM node for a timeline item by its stable item key.
 *
 * This relies on the presenter rendering each row with a
 * `data-timeline-item-key` attribute.
 */
export function findTimelineItemElement(scrollerElement: HTMLElement, targetKey: string): HTMLElement | null {
    return scrollerElement.querySelector<HTMLElement>(`[data-timeline-item-key="${targetKey}"]`);
}

/**
 * Returns whether the target element is already aligned to the requested anchor
 * position within the configured pixel tolerance.
 *
 * Top and bottom alignment are measured against the scroller edges. Center
 * alignment compares the midpoint of the target to the midpoint of the
 * viewport.
 */
export function isScrollTargetAligned({
    scrollerElement,
    targetElement,
    position,
}: {
    scrollerElement: HTMLElement;
    targetElement: HTMLElement;
    position: NavigationAnchor["position"];
}): boolean {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    if (position === undefined || position === "top") {
        return Math.abs(targetRect.top - scrollerRect.top) <= SNAP_TO_TARGET_OFFSET_EPSILON_PX;
    }

    if (position === "bottom") {
        return Math.abs(scrollerRect.bottom - targetRect.bottom) <= SNAP_TO_BOTTOM_TARGET_OFFSET_EPSILON_PX;
    }

    const scrollerCenter = (scrollerRect.top + scrollerRect.bottom) / 2;
    const targetCenter = (targetRect.top + targetRect.bottom) / 2;
    return Math.abs(targetCenter - scrollerCenter) <= SNAP_TO_TARGET_OFFSET_EPSILON_PX;
}

/**
 * Computes the signed scroll delta required to align the target element to the
 * requested anchor position.
 *
 * A positive result means the scroller must move downward. A negative result
 * means it must move upward.
 */
export function getScrollTargetAdjustment({
    scrollerElement,
    targetElement,
    position,
}: {
    scrollerElement: HTMLElement;
    targetElement: HTMLElement;
    position: NavigationAnchor["position"];
}): number {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    if (position === undefined || position === "top") {
        return targetRect.top - scrollerRect.top;
    }

    if (position === "bottom") {
        return targetRect.bottom - scrollerRect.bottom;
    }

    const scrollerCenter = (scrollerRect.top + scrollerRect.bottom) / 2;
    const targetCenter = (targetRect.top + targetRect.bottom) / 2;
    return targetCenter - scrollerCenter;
}

// Local scroll correction ---------------------------------------------------

/**
 * Returns whether applying the requested local correction would produce a
 * meaningful `scrollTop` change after clamping to the top of the scroller.
 */
export function canAdjustScrollTop(currentScrollTop: number, scrollAdjustment: number): boolean {
    const nextScrollTop = currentScrollTop + scrollAdjustment;
    const clampedScrollTop = Math.max(0, nextScrollTop);
    return Math.abs(clampedScrollTop - currentScrollTop) > SNAP_TO_TARGET_OFFSET_EPSILON_PX;
}

/**
 * Returns whether applying the requested local correction would change
 * `scrollTop` enough to matter for precise target alignment.
 *
 * Target anchoring uses a stricter threshold than generic scroll correction so
 * sub-pixel residual offsets can still be nudged into place when bottom
 * alignment requires an exact match.
 */
export function canAdjustScrollTopForTargetAlignment(currentScrollTop: number, scrollAdjustment: number): boolean {
    const nextScrollTop = currentScrollTop + scrollAdjustment;
    const clampedScrollTop = Math.max(0, nextScrollTop);
    return Math.abs(clampedScrollTop - currentScrollTop) > TARGET_ALIGNMENT_SCROLL_ADJUSTMENT_EPSILON_PX;
}

/**
 * Returns whether the requested correction would need to scroll above the start
 * of the currently loaded window, which means local DOM adjustment alone
 * cannot satisfy the anchor.
 */
export function cannotAlignWithinLoadedWindow(currentScrollTop: number, scrollAdjustment: number): boolean {
    return currentScrollTop + scrollAdjustment < 0;
}

/**
 * Applies a local scroll adjustment while clamping the result to the valid
 * lower bound for `scrollTop`.
 */
export function getClampedScrollTop(currentScrollTop: number, scrollAdjustment: number): number {
    return Math.max(0, currentScrollTop + scrollAdjustment);
}

// Bottom-edge and visibility measurement ------------------------------------

/**
 * Measures the vertical distance from the bottom of the viewport to the bottom
 * of a rendered item.
 *
 * This is used to preserve visual position when forward pagination appends new
 * items and the presenter wants the same anchor to remain at the same apparent
 * offset from the bottom.
 */
export function getBottomOffset(scrollerElement: HTMLElement, targetElement: HTMLElement): number {
    return scrollerElement.getBoundingClientRect().bottom - targetElement.getBoundingClientRect().bottom;
}

export function getTopOffset(scrollerElement: HTMLElement, targetElement: HTMLElement): number {
    return targetElement.getBoundingClientRect().top - scrollerElement.getBoundingClientRect().top;
}

/**
 * Returns whether the entire target element is currently visible inside the
 * scroller viewport.
 *
 * This is used as a fallback completion signal for scroll targets that are
 * visually settled but cannot be driven to an exact pixel-perfect anchor due
 * to browser `scrollTop` quantization.
 */
export function isTimelineItemFullyVisible(scrollerElement: HTMLElement, targetElement: HTMLElement): boolean {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    return (
        targetRect.top >= scrollerRect.top - SNAP_TO_TARGET_OFFSET_EPSILON_PX &&
        targetRect.bottom <= scrollerRect.bottom + SNAP_TO_TARGET_OFFSET_EPSILON_PX
    );
}

/**
 * Returns whether the scroller is already close enough to the bottom that a
 * final live-edge snap can be treated as safe and visually stable.
 */
export function canSnapToBottom(scrollerElement: HTMLElement): boolean {
    const remainingScrollPx = scrollerElement.scrollHeight - scrollerElement.clientHeight - scrollerElement.scrollTop;
    return remainingScrollPx <= SNAP_TO_BOTTOM_OFFSET_EPSILON_PX;
}

/**
 * Returns the last timeline item that is meaningfully visible in the viewport.
 *
 * The function prefers the last fully visible item because it is the most
 * stable anchor for preserving position across forward pagination. If no item
 * is fully visible, it falls back to the last intersecting item.
 */
export function getLastVisibleTimelineItemElement(scrollerElement: HTMLElement): HTMLElement | null {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const itemElements = scrollerElement.querySelectorAll<HTMLElement>("[data-timeline-item-key]");

    let lastFullyVisibleElement: HTMLElement | null = null;
    let lastFullyVisibleBottom = Number.NEGATIVE_INFINITY;
    let lastIntersectingElement: HTMLElement | null = null;
    let lastIntersectingBottom = Number.NEGATIVE_INFINITY;

    for (const itemElement of itemElements) {
        const itemRect = itemElement.getBoundingClientRect();
        const intersectsViewport =
            itemRect.bottom > scrollerRect.top + SNAP_TO_TARGET_OFFSET_EPSILON_PX &&
            itemRect.top < scrollerRect.bottom - SNAP_TO_TARGET_OFFSET_EPSILON_PX;
        if (!intersectsViewport) {
            continue;
        }

        if (itemRect.bottom >= lastIntersectingBottom) {
            lastIntersectingBottom = itemRect.bottom;
            lastIntersectingElement = itemElement;
        }

        const isFullyVisible =
            itemRect.top >= scrollerRect.top - SNAP_TO_TARGET_OFFSET_EPSILON_PX &&
            itemRect.bottom <= scrollerRect.bottom + SNAP_TO_TARGET_OFFSET_EPSILON_PX;
        if (!isFullyVisible) {
            continue;
        }

        if (itemRect.bottom >= lastFullyVisibleBottom) {
            lastFullyVisibleBottom = itemRect.bottom;
            lastFullyVisibleElement = itemElement;
        }
    }

    return lastFullyVisibleElement ?? lastIntersectingElement;
}

/**
 * Returns the topmost timeline item that is meaningfully visible in the viewport.
 *
 * For backward-pagination preservation we need the actual topmost visible row,
 * even when it is partially clipped. Using the first fully visible row allows
 * earlier partially visible rows to slide in above the anchor after a window
 * shift, which looks like a jump even if the chosen anchor stayed aligned.
 */
export function getFirstVisibleTimelineItemElement(scrollerElement: HTMLElement): HTMLElement | null {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const itemElements = scrollerElement.querySelectorAll<HTMLElement>("[data-timeline-item-key]");

    let firstIntersectingElement: HTMLElement | null = null;
    let firstIntersectingTop = Number.POSITIVE_INFINITY;

    for (const itemElement of itemElements) {
        const itemRect = itemElement.getBoundingClientRect();
        const intersectsViewport =
            itemRect.bottom > scrollerRect.top + SNAP_TO_TARGET_OFFSET_EPSILON_PX &&
            itemRect.top < scrollerRect.bottom - SNAP_TO_TARGET_OFFSET_EPSILON_PX;
        if (!intersectsViewport) {
            continue;
        }

        if (itemRect.top <= firstIntersectingTop) {
            firstIntersectingTop = itemRect.top;
            firstIntersectingElement = itemElement;
        }
    }

    return firstIntersectingElement;
}
