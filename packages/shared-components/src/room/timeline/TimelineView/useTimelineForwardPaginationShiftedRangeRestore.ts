/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef } from "react";

import { findTimelineItemElement, getBottomOffset, getClampedScrollTop, getTopOffset } from "./TimelineViewDom";
import type { ForwardPaginationContext } from "./useTimelineForwardPagination";

const MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES = 2;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX = 96;
const MAX_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES = 6;
const REQUIRED_STABLE_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES = 2;
const BLOCKED_FORWARD_PAGINATION_SHIFTED_RANGE_RESTORE_EPSILON_PX = 24;
const MAX_FORWARD_PAGINATION_SHIFTED_RANGE_SYNCHRONOUS_LAYOUT_STEPS = 4;

interface UseTimelineForwardPaginationShiftedRangeRestoreParams {
    getForwardPaginationContext: () => ForwardPaginationContext | null;
    getCurrentRangeKey: () => string;
    getBlockedForwardPaginationSlidingRebaseRange: () => string | null;
    setHandledForwardPaginationSlidingRebaseRange: (rangeKey: string | null) => void;
    setBlockedForwardPaginationSlidingRebaseSettledScrollState: (state: {
        rangeKey: string | null;
        scrollTop: number | null;
    }) => void;
    armForwardPaginationSlidingRebaseLock: () => void;
    cancelPendingForwardPaginationSlidingRebaseLock: () => void;
    isForwardPaginationSlidingRebaseVirtuosoRestoreActive: () => boolean;
    clearPendingVisibleRangeDuringForwardSlidingRebaseLock: () => void;
}

/**
 * Restores top-offset continuity when forward pagination changes the rendered
 * visible window instead of simply appending below the current anchor.
 *
 * This hook owns both the direct shifted-range restore loop and the follow-up
 * correction used after Virtuoso reapplies its own range restoration.
 */
export function useTimelineForwardPaginationShiftedRangeRestore({
    getForwardPaginationContext,
    getCurrentRangeKey,
    getBlockedForwardPaginationSlidingRebaseRange,
    setHandledForwardPaginationSlidingRebaseRange,
    setBlockedForwardPaginationSlidingRebaseSettledScrollState,
    armForwardPaginationSlidingRebaseLock,
    cancelPendingForwardPaginationSlidingRebaseLock,
    isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
    clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
}: UseTimelineForwardPaginationShiftedRangeRestoreParams): {
    cancelPendingForwardPaginationShiftedRangeRestore: () => void;
    scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection: (targetScrollerElement: HTMLElement) => void;
    scheduleForwardPaginationShiftedRangeRestore: (
        targetScrollerElement: HTMLElement,
        options?: { skipInitialBlockedRebasePrime?: boolean },
    ) => void;
    isForwardPaginationShiftedRangeRestoreInProgress: () => boolean;
} {
    const forwardPaginationShiftedRangeRestoreFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationShiftedRangeRestoreInProgressRef = useRef(false);
    const forwardPaginationShiftedRangeRestoreGenerationRef = useRef(0);

    const cancelPendingForwardPaginationShiftedRangeRestore = useCallback(() => {
        forwardPaginationShiftedRangeRestoreGenerationRef.current += 1;
        for (const frameId of forwardPaginationShiftedRangeRestoreFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationShiftedRangeRestoreFrameIdsRef.current = [];
        forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
    }, []);

    const scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection = useCallback(
        (targetScrollerElement: HTMLElement) => {
            cancelPendingForwardPaginationShiftedRangeRestore();
            forwardPaginationShiftedRangeRestoreInProgressRef.current = true;
            const restoreGeneration = forwardPaginationShiftedRangeRestoreGenerationRef.current;

            const applyCorrection = (
                attempt: number,
                stableFrameCount: number,
            ): { shouldContinue: boolean; nextStableFrameCount: number } => {
                if (
                    restoreGeneration !== forwardPaginationShiftedRangeRestoreGenerationRef.current ||
                    !targetScrollerElement.isConnected
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorKey = getForwardPaginationContext()?.shiftedRangeAnchorKey;
                const desiredTopOffset = getForwardPaginationContext()?.shiftedRangeTopOffsetPx;
                const desiredBottomOffset = getForwardPaginationContext()?.shiftedRangeBottomOffsetPx;
                const shouldUseBottomOffset = false;
                if (!anchorKey || (shouldUseBottomOffset ? desiredBottomOffset == null : desiredTopOffset == null)) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorElement = findTimelineItemElement(targetScrollerElement, anchorKey);
                if (!anchorElement) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentOffset = shouldUseBottomOffset
                    ? getBottomOffset(targetScrollerElement, anchorElement)
                    : getTopOffset(targetScrollerElement, anchorElement);
                const desiredOffset = shouldUseBottomOffset ? desiredBottomOffset : desiredTopOffset;
                const scrollAdjustment = currentOffset - (desiredOffset ?? 0);
                const nextStableFrameCount = Math.abs(scrollAdjustment) <= 1 ? stableFrameCount + 1 : 0;
                if (scrollAdjustment !== 0) {
                    const nextScrollTop = targetScrollerElement.scrollTop + scrollAdjustment;
                    targetScrollerElement.scrollTo({
                        top: nextScrollTop,
                    });
                }

                if (
                    attempt >= MAX_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES ||
                    nextStableFrameCount >= REQUIRED_STABLE_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount };
                }

                return { shouldContinue: true, nextStableFrameCount };
            };

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    const correction = applyCorrection(attempt, stableFrameCount);
                    if (!correction.shouldContinue) {
                        return;
                    }

                    scheduleFrame(attempt + 1, correction.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(frameId);
            };

            const firstLayoutFrameId = window.requestAnimationFrame(() => {
                forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== firstLayoutFrameId,
                    );

                const secondLayoutFrameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== secondLayoutFrameId,
                        );

                    const correction = applyCorrection(0, 0);
                    if (!correction.shouldContinue) {
                        return;
                    }

                    scheduleFrame(1, correction.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(secondLayoutFrameId);
            });

            forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(firstLayoutFrameId);
        },
        [cancelPendingForwardPaginationShiftedRangeRestore, getForwardPaginationContext],
    );

    const scheduleForwardPaginationShiftedRangeRestore = useCallback(
        (targetScrollerElement: HTMLElement, options?: { skipInitialBlockedRebasePrime?: boolean }) => {
            if (isForwardPaginationSlidingRebaseVirtuosoRestoreActive()) {
                return;
            }

            const anchorKey = getForwardPaginationContext()?.shiftedRangeAnchorKey;
            const desiredTopOffset = getForwardPaginationContext()?.shiftedRangeTopOffsetPx;
            if (!anchorKey || desiredTopOffset === null || desiredTopOffset === undefined) {
                return;
            }

            cancelPendingForwardPaginationShiftedRangeRestore();
            forwardPaginationShiftedRangeRestoreInProgressRef.current = true;
            const restoreGeneration = forwardPaginationShiftedRangeRestoreGenerationRef.current;
            const skipInitialBlockedRebasePrime = options?.skipInitialBlockedRebasePrime ?? false;

            const applyRestoreStep = (
                attempt: number,
                stableFrameCount: number,
                phase: "layout" | "frame",
            ): { shouldContinue: boolean; nextStableFrameCount: number } => {
                const currentRangeKey = getCurrentRangeKey();
                const blockedForwardSlidingRebaseRecoveryActive =
                    getBlockedForwardPaginationSlidingRebaseRange() === currentRangeKey;
                if (blockedForwardSlidingRebaseRecoveryActive) {
                    armForwardPaginationSlidingRebaseLock();
                }

                if (
                    restoreGeneration !== forwardPaginationShiftedRangeRestoreGenerationRef.current ||
                    isForwardPaginationSlidingRebaseVirtuosoRestoreActive()
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                if (!targetScrollerElement.isConnected) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentAnchorKey = getForwardPaginationContext()?.shiftedRangeAnchorKey;
                const currentDesiredTopOffset = getForwardPaginationContext()?.shiftedRangeTopOffsetPx;
                const currentDesiredBottomOffset = getForwardPaginationContext()?.shiftedRangeBottomOffsetPx;
                const shouldUseBottomOffset = false;
                if (
                    !currentAnchorKey ||
                    (shouldUseBottomOffset
                        ? currentDesiredBottomOffset === null || currentDesiredBottomOffset === undefined
                        : currentDesiredTopOffset === null || currentDesiredTopOffset === undefined)
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorElement = findTimelineItemElement(targetScrollerElement, currentAnchorKey);
                if (!anchorElement) {
                    const shouldDeferInitialBlockedForwardSlidingRebasePrime =
                        blockedForwardSlidingRebaseRecoveryActive &&
                        skipInitialBlockedRebasePrime &&
                        attempt === 0 &&
                        phase === "layout";
                    if (shouldDeferInitialBlockedForwardSlidingRebasePrime) {
                        return { shouldContinue: true, nextStableFrameCount: 0 };
                    }
                    const shouldPrimeBlockedForwardSlidingRebaseRecovery =
                        blockedForwardSlidingRebaseRecoveryActive &&
                        targetScrollerElement.clientHeight > 0 &&
                        attempt < MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES;
                    if (shouldPrimeBlockedForwardSlidingRebaseRecovery) {
                        const primeStepPx = Math.min(
                            MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX,
                            targetScrollerElement.clientHeight,
                        );
                        const nextScrollTop = getClampedScrollTop(targetScrollerElement.scrollTop, -primeStepPx);
                        if (nextScrollTop !== targetScrollerElement.scrollTop) {
                            targetScrollerElement.scrollTo({
                                top: nextScrollTop,
                            });
                        }
                        return { shouldContinue: true, nextStableFrameCount: 0 };
                    }
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentOffset = shouldUseBottomOffset
                    ? getBottomOffset(targetScrollerElement, anchorElement)
                    : getTopOffset(targetScrollerElement, anchorElement);
                const desiredOffset = shouldUseBottomOffset ? currentDesiredBottomOffset : currentDesiredTopOffset;
                const rawScrollAdjustment = currentOffset - (desiredOffset ?? 0);
                const shouldClampAtBottomShiftedRangeRestoreAdjustment =
                    shouldUseBottomOffset && phase === "layout" && targetScrollerElement.clientHeight > 0;
                const maxClampedAdjustmentPx = shouldClampAtBottomShiftedRangeRestoreAdjustment
                    ? Math.min(MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX, targetScrollerElement.clientHeight)
                    : null;
                const shouldAcceptBlockedForwardSlidingRebaseResidualOffset =
                    blockedForwardSlidingRebaseRecoveryActive &&
                    Math.abs(rawScrollAdjustment) <= BLOCKED_FORWARD_PAGINATION_SHIFTED_RANGE_RESTORE_EPSILON_PX;
                const unclampedScrollAdjustment = shouldAcceptBlockedForwardSlidingRebaseResidualOffset
                    ? 0
                    : rawScrollAdjustment;
                const scrollAdjustment =
                    maxClampedAdjustmentPx == null
                        ? unclampedScrollAdjustment
                        : Math.max(
                              -maxClampedAdjustmentPx,
                              Math.min(maxClampedAdjustmentPx, unclampedScrollAdjustment),
                          );
                const nextStableFrameCount = shouldAcceptBlockedForwardSlidingRebaseResidualOffset
                    ? REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES
                    : Math.abs(scrollAdjustment) <= 1
                      ? stableFrameCount + 1
                      : 0;

                if (scrollAdjustment !== 0) {
                    targetScrollerElement.scrollTo({
                        top: targetScrollerElement.scrollTop + scrollAdjustment,
                    });
                }

                if (
                    attempt >= MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES ||
                    nextStableFrameCount >= REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES
                ) {
                    const settledBlockedForwardSlidingRebaseRange =
                        getBlockedForwardPaginationSlidingRebaseRange() === getCurrentRangeKey();
                    if (settledBlockedForwardSlidingRebaseRange) {
                        setHandledForwardPaginationSlidingRebaseRange(getCurrentRangeKey());
                        setBlockedForwardPaginationSlidingRebaseSettledScrollState({
                            rangeKey: getCurrentRangeKey(),
                            scrollTop: targetScrollerElement.scrollTop,
                        });
                        clearPendingVisibleRangeDuringForwardSlidingRebaseLock();
                        cancelPendingForwardPaginationSlidingRebaseLock();
                    }
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount };
                }

                return { shouldContinue: true, nextStableFrameCount };
            };

            let layoutAttempt = 0;
            let stableFrameCount = 0;
            let initialStep = applyRestoreStep(layoutAttempt, stableFrameCount, "layout");
            while (
                initialStep.shouldContinue &&
                getForwardPaginationContext()?.requestReason === "at-bottom state change" &&
                stableFrameCount < REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES &&
                layoutAttempt < MAX_FORWARD_PAGINATION_SHIFTED_RANGE_SYNCHRONOUS_LAYOUT_STEPS - 1
            ) {
                layoutAttempt += 1;
                stableFrameCount = initialStep.nextStableFrameCount;
                initialStep = applyRestoreStep(layoutAttempt, stableFrameCount, "layout");
            }

            if (!initialStep.shouldContinue) {
                return;
            }

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    const step = applyRestoreStep(attempt, stableFrameCount, "frame");
                    if (!step.shouldContinue) {
                        return;
                    }

                    scheduleFrame(attempt + 1, step.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(layoutAttempt + 1, initialStep.nextStableFrameCount);
        },
        [
            armForwardPaginationSlidingRebaseLock,
            cancelPendingForwardPaginationShiftedRangeRestore,
            cancelPendingForwardPaginationSlidingRebaseLock,
            clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
            getBlockedForwardPaginationSlidingRebaseRange,
            getCurrentRangeKey,
            getForwardPaginationContext,
            isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
            setBlockedForwardPaginationSlidingRebaseSettledScrollState,
            setHandledForwardPaginationSlidingRebaseRange,
        ],
    );

    const isForwardPaginationShiftedRangeRestoreInProgress = useCallback(() => {
        return forwardPaginationShiftedRangeRestoreInProgressRef.current;
    }, []);

    useEffect(() => {
        return () => {
            cancelPendingForwardPaginationShiftedRangeRestore();
        };
    }, [cancelPendingForwardPaginationShiftedRangeRestore]);

    return {
        cancelPendingForwardPaginationShiftedRangeRestore,
        scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection,
        scheduleForwardPaginationShiftedRangeRestore,
        isForwardPaginationShiftedRangeRestoreInProgress,
    };
}
