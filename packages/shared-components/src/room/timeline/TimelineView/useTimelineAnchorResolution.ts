/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useLayoutEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
    canAdjustScrollTop,
    cannotAlignWithinLoadedWindow,
    findTimelineItemElement,
    getClampedScrollTop,
    getScrollTargetAdjustment,
    isScrollTargetAligned,
} from "./TimelineViewDom";
import type { TimelineItem, TimelineViewModel, TimelineViewSnapshot } from "./types";

type InitialFillState = "filling" | "settling" | "done";

/**
 * Maximum number of local DOM-based retries when trying to align an anchor
 * after virtualization or pagination changes the rendered geometry.
 */
export const MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS = 6;

/**
 * Number of consecutive successful alignment checks required before the
 * presenter considers an anchor stably resolved.
 */
export const REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS = 2;

interface UseTimelineAnchorResolutionParams<TItem extends TimelineItem> {
    vm: TimelineViewModel<TItem>;
    snapshot: TimelineViewSnapshot<TItem>;
    initialFillState: InitialFillState;
    scrollerElement: HTMLElement | null;
    acknowledgedScrollTargetKeyRef: MutableRefObject<string | null>;
    getScrollTargetCorrectionGeneration: () => number;
    advanceScrollTargetCorrectionGeneration: () => number;
    resetAnchorResolutionRetryCount: () => void;
    getAnchorResolutionRetryCount: () => number;
    incrementAnchorResolutionRetryCount: () => void;
    anchorResolutionRetryNonce: number;
    setAnchorResolutionRetryNonce: Dispatch<SetStateAction<number>>;
    markAnchorResolved: () => void;
    prepareBackwardAnchorFetch: () => void;
}

function getEffectiveScrollerElement(scrollerElement: HTMLElement | null): HTMLElement | null {
    return scrollerElement ?? document.querySelector<HTMLElement>("[data-virtuoso-scroller='true']");
}

/**
 * Owns scroll-target alignment after initial render, pagination, and virtualization
 * reflows.
 *
 * The presenter supplies the mutable coordination state and callbacks while this
 * hook handles DOM-based retries, local correction, and "anchor reached"
 * acknowledgement.
 */
export function useTimelineAnchorResolution<TItem extends TimelineItem>({
    vm,
    snapshot,
    initialFillState,
    scrollerElement,
    acknowledgedScrollTargetKeyRef,
    getScrollTargetCorrectionGeneration,
    advanceScrollTargetCorrectionGeneration,
    resetAnchorResolutionRetryCount,
    getAnchorResolutionRetryCount,
    incrementAnchorResolutionRetryCount,
    anchorResolutionRetryNonce,
    setAnchorResolutionRetryNonce,
    markAnchorResolved,
    prepareBackwardAnchorFetch,
}: UseTimelineAnchorResolutionParams<TItem>): void {
    const acknowledgedScrollTargetRef = acknowledgedScrollTargetKeyRef;

    useEffect(() => {
        resetAnchorResolutionRetryCount();
    }, [resetAnchorResolutionRetryCount, vm, snapshot.scrollTarget]);

    useEffect(() => {
        if (!snapshot.scrollTarget || acknowledgedScrollTargetRef.current === snapshot.scrollTarget.targetKey) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
            if (!effectiveScrollerElement || effectiveScrollerElement.clientHeight === 0) {
                return;
            }

            const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget!.targetKey);
            if (!targetElement) {
                return;
            }

            const aligned = isScrollTargetAligned({
                scrollerElement: effectiveScrollerElement,
                targetElement,
                position: snapshot.scrollTarget!.position,
            });
            if (!aligned) {
                return;
            }

            markAnchorResolved();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [acknowledgedScrollTargetRef, markAnchorResolved, scrollerElement, snapshot.scrollTarget]);

    useLayoutEffect(() => {
        if (!snapshot.scrollTarget) {
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement) {
            return;
        }

        const scheduleRetry = (): void => {
            if (getAnchorResolutionRetryCount() < 2) {
                incrementAnchorResolutionRetryCount();
                setAnchorResolutionRetryNonce((currentNonce) => currentNonce + 1);
            }
        };

        const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget.targetKey);
        if (!targetElement) {
            if (
                initialFillState === "filling" &&
                snapshot.backwardPagination === "idle" &&
                snapshot.canPaginateBackward
            ) {
                prepareBackwardAnchorFetch();
                vm.onRequestMoreItems("backward");
            } else {
                scheduleRetry();
            }
            return;
        }

        if (effectiveScrollerElement.clientHeight === 0) {
            scheduleRetry();
            return;
        }

        resetAnchorResolutionRetryCount();

        const scrollAdjustment = getScrollTargetAdjustment({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        const aligned = isScrollTargetAligned({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });

        if (
            !aligned &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "loading" &&
            !canAdjustScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment)
        ) {
            return;
        }

        const correctionGeneration = advanceScrollTargetCorrectionGeneration();

        if (!aligned && canAdjustScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment)) {
            effectiveScrollerElement.scrollTo({
                top: getClampedScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment),
            });

            const targetKey = snapshot.scrollTarget.targetKey;
            const targetPosition = snapshot.scrollTarget.position;
            const verifyLocalAnchorCorrection = (attempt = 0, stableAlignmentChecks = 0): void => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (getScrollTargetCorrectionGeneration() !== correctionGeneration) {
                            return;
                        }

                        const latestTargetElement = findTimelineItemElement(effectiveScrollerElement, targetKey);
                        if (!latestTargetElement) {
                            return;
                        }

                        const adjustmentAfterCorrection = getScrollTargetAdjustment({
                            scrollerElement: effectiveScrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });
                        const alignedAfterAdjustment = isScrollTargetAligned({
                            scrollerElement: effectiveScrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });

                        if (alignedAfterAdjustment) {
                            if (snapshot.backwardPagination === "loading") {
                                return;
                            }

                            if (stableAlignmentChecks + 1 < REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS) {
                                verifyLocalAnchorCorrection(attempt + 1, stableAlignmentChecks + 1);
                                return;
                            }

                            markAnchorResolved();
                            return;
                        }

                        if (
                            canAdjustScrollTop(effectiveScrollerElement.scrollTop, adjustmentAfterCorrection) &&
                            attempt < MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS
                        ) {
                            effectiveScrollerElement.scrollTo({
                                top: getClampedScrollTop(effectiveScrollerElement.scrollTop, adjustmentAfterCorrection),
                            });
                            verifyLocalAnchorCorrection(attempt + 1, 0);
                            return;
                        }

                        if (initialFillState === "filling") {
                            if (
                                snapshot.backwardPagination === "idle" &&
                                snapshot.canPaginateBackward &&
                                cannotAlignWithinLoadedWindow(
                                    effectiveScrollerElement.scrollTop,
                                    adjustmentAfterCorrection,
                                )
                            ) {
                                prepareBackwardAnchorFetch();
                                vm.onRequestMoreItems("backward");
                                return;
                            }

                            scheduleRetry();
                        }
                    });
                });
            };

            verifyLocalAnchorCorrection();
            return;
        }

        if (
            !aligned &&
            cannotAlignWithinLoadedWindow(effectiveScrollerElement.scrollTop, scrollAdjustment) &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "idle" &&
            snapshot.canPaginateBackward
        ) {
            prepareBackwardAnchorFetch();
            vm.onRequestMoreItems("backward");
            return;
        }

        if (
            !aligned &&
            cannotAlignWithinLoadedWindow(effectiveScrollerElement.scrollTop, scrollAdjustment) &&
            initialFillState === "filling" &&
            snapshot.canPaginateBackward
        ) {
            return;
        }

        if (!aligned && initialFillState === "filling") {
            scheduleRetry();
            return;
        }

        if (!aligned) {
            return;
        }

        markAnchorResolved();
    }, [
        vm,
        initialFillState,
        markAnchorResolved,
        prepareBackwardAnchorFetch,
        scrollerElement,
        advanceScrollTargetCorrectionGeneration,
        anchorResolutionRetryNonce,
        getAnchorResolutionRetryCount,
        getScrollTargetCorrectionGeneration,
        incrementAnchorResolutionRetryCount,
        resetAnchorResolutionRetryCount,
        setAnchorResolutionRetryNonce,
        snapshot.scrollTarget,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
    ]);

    useEffect(() => {
        if (!snapshot.scrollTarget) {
            return;
        }

        if (initialFillState === "filling") {
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement || effectiveScrollerElement.clientHeight === 0) {
            return;
        }

        const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget.targetKey);
        if (!targetElement) {
            return;
        }

        if (snapshot.backwardPagination === "loading") {
            return;
        }

        const aligned = isScrollTargetAligned({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        if (!aligned) {
            return;
        }

        markAnchorResolved();
    }, [
        initialFillState,
        markAnchorResolved,
        scrollerElement,
        snapshot.scrollTarget,
        snapshot.backwardPagination,
        snapshot.items,
    ]);
}
