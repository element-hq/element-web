/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { TimelineItem } from "./types";

/**
 * Shared helpers for the current `TimelineView` implementation.
 */
export const INITIAL_FIRST_ITEM_INDEX = 100_000;

function findFirstOverlap<TItem extends TimelineItem>(
    prevItems: TItem[],
    nextIndexesByKey: Map<string, number>,
): { prevOverlapStart: number; nextOverlapStart: number } | null {
    for (let index = 0; index < prevItems.length; index += 1) {
        const candidateIndex = nextIndexesByKey.get(prevItems[index].key);
        if (candidateIndex !== undefined) {
            return {
                prevOverlapStart: index,
                nextOverlapStart: candidateIndex,
            };
        }
    }

    return null;
}

function getOverlapLength<TItem extends TimelineItem>(
    prevItems: TItem[],
    nextItems: TItem[],
    prevOverlapStart: number,
    nextOverlapStart: number,
): number {
    let overlapLength = 0;
    while (
        prevOverlapStart + overlapLength < prevItems.length &&
        nextOverlapStart + overlapLength < nextItems.length &&
        prevItems[prevOverlapStart + overlapLength].key === nextItems[nextOverlapStart + overlapLength].key
    ) {
        overlapLength += 1;
    }

    return overlapLength;
}

function hasUnexpectedLeadingOverlap<TItem extends TimelineItem>(
    prevItems: TItem[],
    prevOverlapStart: number,
    nextIndexesByKey: Map<string, number>,
): boolean {
    for (let index = 0; index < prevOverlapStart; index += 1) {
        if (nextIndexesByKey.has(prevItems[index].key)) {
            return true;
        }
    }

    return false;
}

function hasUnexpectedTrailingOverlap<TItem extends TimelineItem>(
    nextItems: TItem[],
    nextOverlapStart: number,
    overlapLength: number,
    prevKeys: Set<string>,
): boolean {
    for (let index = nextOverlapStart + overlapLength; index < nextItems.length; index += 1) {
        if (prevKeys.has(nextItems[index].key)) {
            return true;
        }
    }

    return false;
}

/**
 * Computes how far the loaded item window moved when two arrays still describe
 * the same contiguous slice after pagination.
 */
export function getContiguousWindowShift<TItem extends TimelineItem>(prevItems: TItem[], nextItems: TItem[]): number {
    if (prevItems === nextItems || prevItems.length === 0 || nextItems.length === 0) {
        return 0;
    }

    const previousFirstKey = prevItems[0]?.key;
    const previousLastKey = prevItems[prevItems.length - 1]?.key;
    const nextFirstKey = nextItems[0]?.key;
    const nextLastKey = nextItems[nextItems.length - 1]?.key;

    if (prevItems.length === nextItems.length && previousFirstKey === nextFirstKey && previousLastKey === nextLastKey) {
        return 0;
    }

    const nextIndexesByKey = new Map<string, number>();
    for (let index = 0; index < nextItems.length; index += 1) {
        nextIndexesByKey.set(nextItems[index].key, index);
    }

    const overlap = findFirstOverlap(prevItems, nextIndexesByKey);
    if (!overlap) {
        return 0;
    }

    const { prevOverlapStart, nextOverlapStart } = overlap;
    const overlapLength = getOverlapLength(prevItems, nextItems, prevOverlapStart, nextOverlapStart);
    if (overlapLength === 0) {
        return 0;
    }

    const prevKeys = new Set<string>();
    for (const item of prevItems) {
        prevKeys.add(item.key);
    }

    if (
        hasUnexpectedLeadingOverlap(prevItems, prevOverlapStart, nextIndexesByKey) ||
        hasUnexpectedTrailingOverlap(nextItems, nextOverlapStart, overlapLength, prevKeys)
    ) {
        return 0;
    }

    return nextOverlapStart - prevOverlapStart;
}

/**
 * Being at the bottom of the currently loaded window only counts as being at
 * the true live edge when forward pagination is exhausted.
 */
export function getIsAtLiveEdgeFromBottomState({
    atBottom,
    canPaginateForward,
}: {
    atBottom: boolean;
    canPaginateForward: boolean;
}): boolean {
    return atBottom && !canPaginateForward;
}
