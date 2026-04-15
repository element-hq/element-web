/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { NavigationAnchor } from "./types";

export const MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS = 6;
export const REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS = 2;
const SNAP_TO_TARGET_OFFSET_EPSILON_PX = 1;
export const SNAP_TO_BOTTOM_OFFSET_EPSILON_PX = 16;

export function findTimelineItemElement(scrollerElement: HTMLElement, targetKey: string): HTMLElement | null {
    return scrollerElement.querySelector<HTMLElement>(`[data-timeline-item-key="${targetKey}"]`);
}

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
        return Math.abs(scrollerRect.bottom - targetRect.bottom) <= SNAP_TO_TARGET_OFFSET_EPSILON_PX;
    }

    const scrollerCenter = (scrollerRect.top + scrollerRect.bottom) / 2;
    const targetCenter = (targetRect.top + targetRect.bottom) / 2;
    return Math.abs(targetCenter - scrollerCenter) <= SNAP_TO_TARGET_OFFSET_EPSILON_PX;
}

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

export function canAdjustScrollTop(currentScrollTop: number, scrollAdjustment: number): boolean {
    const nextScrollTop = currentScrollTop + scrollAdjustment;
    const clampedScrollTop = Math.max(0, nextScrollTop);
    return Math.abs(clampedScrollTop - currentScrollTop) > SNAP_TO_TARGET_OFFSET_EPSILON_PX;
}

export function cannotAlignWithinLoadedWindow(currentScrollTop: number, scrollAdjustment: number): boolean {
    return currentScrollTop + scrollAdjustment < 0;
}

export function getClampedScrollTop(currentScrollTop: number, scrollAdjustment: number): number {
    return Math.max(0, currentScrollTop + scrollAdjustment);
}

export function getBottomOffset(scrollerElement: HTMLElement, targetElement: HTMLElement): number {
    return scrollerElement.getBoundingClientRect().bottom - targetElement.getBoundingClientRect().bottom;
}

export function canSnapToBottom(scrollerElement: HTMLElement): boolean {
    const remainingScrollPx = scrollerElement.scrollHeight - scrollerElement.clientHeight - scrollerElement.scrollTop;
    return remainingScrollPx <= SNAP_TO_BOTTOM_OFFSET_EPSILON_PX;
}

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
